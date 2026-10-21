import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  claimItem,
  closeReport,
  decide,
  editReport,
  reportInput,
  requireAdmin,
  type Report,
  type Claim,
  type User,
} from "./domain";
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const TableName = process.env.TABLE_NAME!;
const Bucket = process.env.BUCKET_NAME!;
const key = (id: string) => ({ pk: id, sk: "DATA" });
async function get<T>(id: string) {
  const x = await db.send(
    new GetCommand({ TableName, Key: key(id), ConsistentRead: true }),
  );
  if (!x.Item) throw Error("Record not found");
  return x.Item.data as T;
}
const record = (data: Report | Claim, kind: string, owner: string) => ({
  ...key(`${kind}#${data.id}`),
  gpk: kind,
  gsk: `${data.createdAt}#${data.id}`,
  opk: owner,
  osk: `${kind}#${data.createdAt}#${data.id}`,
  data,
});
const update = (
  data: Report | Claim,
  kind: string,
  owner: string,
  version: number,
) => ({
  Put: {
    TableName,
    Item: record(data, kind, owner),
    ConditionExpression: "#d.#v = :v",
    ExpressionAttributeNames: { "#d": "data", "#v": "version" },
    ExpressionAttributeValues: { ":v": version },
  },
});
export async function handler(event: any) {
  try {
    const jwt = event.requestContext?.authorizer?.jwt?.claims;
    if (!jwt?.sub) return response(401, { message: "Sign in required" });
    const u: User = {
      id: jwt.sub,
      email: String(jwt.email || ""),
      admin: (Array.isArray(jwt["cognito:groups"])
        ? jwt["cognito:groups"]
        : String(jwt["cognito:groups"] || "")
            .replace(/[\[\]"]/g, "")
            .split(",")
            .map((group: string) => group.trim())
      ).includes("Administrators"),
    };
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const p = event.body ? JSON.parse(event.body) : {};
    if (method === "GET" && (path === "/reports" || path === "/claims")) {
      const kind = path === "/reports" ? "REPORT" : "CLAIM";
      const own = kind === "CLAIM" && !u.admin;
      const cursor = event.queryStringParameters?.cursor;
      const result = await db.send(
        new QueryCommand({
          TableName,
          IndexName: own ? "ByOwner" : "ByKind",
          KeyConditionExpression: own
            ? "opk = :p AND begins_with(osk, :k)"
            : "gpk = :p",
          ExpressionAttributeValues: own
            ? { ":p": u.id, ":k": "CLAIM#" }
            : { ":p": kind },
          Limit: 24,
          ScanIndexForward: false,
          ExclusiveStartKey: cursor
            ? JSON.parse(Buffer.from(cursor, "base64url").toString())
            : undefined,
        }),
      );
      const items = (result.Items || [])
        .map((x) => x.data)
        .filter((x) => kind !== "CLAIM" || u.admin || x.claimantId === u.id);
      return response(200, {
        items,
        cursor: result.LastEvaluatedKey
          ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString(
              "base64url",
            )
          : null,
      });
    }
    if (method === "POST" && path === "/uploads") {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(p.type) ||
        !Number.isInteger(p.size) ||
        p.size < 1 ||
        p.size > 5242880
      )
        throw Error("Invalid photo type or size");
      const objectKey = `${u.id}/${crypto.randomUUID()}`;
      const signed = await createPresignedPost(s3, {
        Bucket,
        Key: objectKey,
        Expires: 120,
        Fields: { "Content-Type": p.type },
        Conditions: [
          ["content-length-range", 1, 5242880],
          ["eq", "$Content-Type", p.type],
        ],
      });
      return response(200, { ...signed, key: objectKey });
    }
    if (method === "GET" && path.startsWith("/photos/")) {
      const r = await get<Report>(
        `REPORT#${decodeURIComponent(path.slice(8))}`,
      );
      if (!r.photoKey) throw Error("Photo not found");
      return response(200, {
        url: await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket, Key: r.photoKey }),
          { expiresIn: 120 },
        ),
      });
    }
    if (method === "POST" && path === "/reports") {
      const now = new Date().toISOString();
      const r: Report = {
        ...reportInput.parse(p),
        id: crypto.randomUUID(),
        reporterId: u.id,
        status: "open",
        createdAt: now,
        updatedAt: now,
        version: 0,
      };
      if (p.photoKey) {
        if (
          typeof p.photoKey !== "string" ||
          !p.photoKey.startsWith(`${u.id}/`)
        )
          throw Error("Invalid photo ownership");
        const h = await s3.send(
          new HeadObjectCommand({ Bucket, Key: p.photoKey }),
        );
        if (
          !h.ContentLength ||
          h.ContentLength > 5242880 ||
          !["image/jpeg", "image/png", "image/webp"].includes(
            h.ContentType || "",
          )
        )
          throw Error("Invalid uploaded photo");
        r.photoKey = p.photoKey;
      }
      await db.send(
        new PutCommand({
          TableName,
          Item: record(r, "REPORT", u.id),
          ConditionExpression: "attribute_not_exists(pk)",
        }),
      );
      return response(201, { id: r.id });
    }
    if (method === "POST" && ["/edit", "/close"].includes(path)) {
      const r = await get<Report>(`REPORT#${p.reportId}`);
      const next = path === "/edit" ? editReport(r, u, p) : closeReport(r, u);
      await db.send(
        new TransactWriteCommand({
          TransactItems: [update(next, "REPORT", r.reporterId, r.version)],
        }),
      );
      return response(200, { ok: true });
    }
    if (method === "POST" && path === "/claim") {
      const r = await get<Report>(`REPORT#${p.reportId}`);
      let old: Claim | undefined;
      try {
        old = await get<Claim>(`CLAIM#${r.id}:${u.id}`);
      } catch (e) {
        if ((e as Error).message !== "Record not found") throw e;
      }
      const c = claimItem(r, u, p.evidence, old);
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              ConditionCheck: {
                TableName,
                Key: key(`REPORT#${r.id}`),
                ConditionExpression: "#d.#v = :v AND #d.#s = :s",
                ExpressionAttributeNames: {
                  "#d": "data",
                  "#v": "version",
                  "#s": "status",
                },
                ExpressionAttributeValues: { ":v": r.version, ":s": "open" },
              },
            },
            old
              ? update(c, "CLAIM", u.id, old.version)
              : {
                  Put: {
                    TableName,
                    Item: record(c, "CLAIM", u.id),
                    ConditionExpression: "attribute_not_exists(pk)",
                  },
                },
          ],
        }),
      );
      return response(201, { ok: true });
    }
    if (method === "POST" && path === "/decision") {
      requireAdmin(u);
      const c = await get<Claim>(`CLAIM#${p.claimId}`);
      const r = await get<Report>(`REPORT#${c.reportId}`);
      const next = decide(r, c, u, p.action, p.reason, p.collection);
      await db.send(
        new TransactWriteCommand({
          TransactItems: [
            update(next.report, "REPORT", r.reporterId, r.version),
            update(next.claim, "CLAIM", c.claimantId, c.version),
          ],
        }),
      );
      return response(200, { ok: true });
    }
    return response(404, { message: "Route not found" });
  } catch (e: any) {
    if (
      [
        "TransactionCanceledException",
        "ConditionalCheckFailedException",
      ].includes(e.name)
    )
      return response(409, {
        message: "This item changed. Refresh and try again.",
      });
    if (e.name === "ZodError")
      return response(400, {
        message: e.issues
          .map((i: any) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    console.error("Request failed", e.name);
    return response(400, { message: e.message || "Request failed" });
  }
}
function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}
