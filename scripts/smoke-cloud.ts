/** Live AWS integration test. Creates only tagged temporary users/records and removes them in finally. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { Amplify } from "aws-amplify";
import { signIn, signOut, fetchAuthSession } from "aws-amplify/auth";
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminAddUserToGroupCommand,
  AdminDeleteUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const stack = process.argv[2];
const region = process.argv[3] || "ap-south-1";
if (!stack) throw Error("Usage: npm run test:cloud -- <stack-name> [region]");
const output = JSON.parse(
  execFileSync(
    "aws",
    [
      "cloudformation",
      "describe-stacks",
      "--stack-name",
      stack,
      "--region",
      region,
      "--query",
      "Stacks[0].Outputs",
      "--output",
      "json",
    ],
    { encoding: "utf8" },
  ),
);
const config: Record<string, string> = Object.fromEntries(
  output.map((x: any) => [x.OutputKey, x.OutputValue]),
);
const cognito = new CognitoIdentityProviderClient({ region });
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const s3 = new S3Client({ region });
const users: string[] = [];
const reportIds: string[] = [];
const claimIds: string[] = [];
let photoKey = "";
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: config.UserPoolId,
      userPoolClientId: config.UserPoolClientId,
    },
  },
});
async function identity(role: string) {
  const username = `cloud-smoke-${role}-${randomUUID()}@${config.CampusEmailDomain}`;
  const password = `Aa1!${randomBytes(24).toString("hex")}`;
  const created = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: config.UserPoolId,
      Username: username,
      MessageAction: "SUPPRESS",
      UserAttributes: [
        { Name: "email", Value: username },
        { Name: "email_verified", Value: "true" },
      ],
    }),
  );
  users.push(username);
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: config.UserPoolId,
      Username: username,
      Password: password,
      Permanent: true,
    }),
  );
  if (role === "admin")
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: config.UserPoolId,
        Username: username,
        GroupName: "Administrators",
      }),
    );
  await signOut();
  const signed = await signIn({ username, password });
  assert.equal(signed.isSignedIn, true, "Cognito SRP sign-in must succeed");
  const session = await fetchAuthSession();
  return {
    id: created.User?.Attributes?.find((x) => x.Name === "sub")?.Value!,
    token: session.tokens!.accessToken.toString(),
  };
}
async function request(path: string, token?: string, body?: unknown) {
  const response = await fetch(config.ApiUrl + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  return { status: response.status, data };
}
function expect(result: { status: number; data: any }, status: number) {
  assert.equal(
    result.status,
    status,
    `Expected ${status}; received ${result.status}: ${JSON.stringify(result.data)}`,
  );
  return result.data;
}
try {
  const preflight = await fetch(config.ApiUrl + "/reports", {
    method: "OPTIONS",
    headers: {
      Origin: config.FrontendUrl,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  assert.ok(
    [200, 204].includes(preflight.status),
    "API browser preflight must not require a token",
  );
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    config.FrontendUrl,
  );
  expect(await request("/reports"), 401);
  const finder = await identity("finder");
  const owner = await identity("owner");
  const rival = await identity("rival");
  const admin = await identity("admin");
  console.log(
    "PASS: real Cognito SRP authentication, group assignment, and anonymous API rejection",
  );
  const photo = expect(
    await request("/uploads", finder.token, { type: "image/png", size: 68 }),
    200,
  );
  photoKey = photo.key;
  const form = new FormData();
  Object.entries(photo.fields).forEach(([k, v]) => form.append(k, String(v)));
  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5XkAAAAASUVORK5CYII=",
    "base64",
  );
  form.append("file", new Blob([pixel], { type: "image/png" }), "test.png");
  assert.equal(
    (await fetch(photo.url, { method: "POST", body: form })).ok,
    true,
    "Private S3 upload",
  );
  const fields = {
    title: "[CLOUD SMOKE TEST] Calculator",
    type: "found",
    category: "electronics",
    description:
      "Temporary integration test report. Removed automatically after verification.",
    location: "Cloud test desk",
    date: new Date().toISOString().slice(0, 10),
    photoKey,
  };
  const report = expect(
    await request("/reports", finder.token, fields),
    201,
  ).report;
  reportIds.push(report.id);
  expect(
    await request("/edit", owner.token, { ...fields, reportId: report.id }),
    403,
  );
  expect(
    await request("/claim", finder.token, {
      reportId: report.id,
      evidence: "A private identifier for my own item",
    }),
    400,
  );
  const view = expect(await request(`/photos/${report.id}`, owner.token), 200);
  assert.equal((await fetch(view.url)).status, 200, "Signed S3 view");
  const privateObject = new URL(view.url);
  privateObject.search = "";
  assert.equal(
    (await fetch(privateObject)).status,
    403,
    "Unsigned S3 access blocked",
  );
  console.log(
    "PASS: real S3 upload/view, private bucket access, report ownership enforcement",
  );
  const evidence = `Private owner evidence ${randomUUID()}`;
  const first = expect(
    await request("/claim", owner.token, { reportId: report.id, evidence }),
    201,
  ).claim;
  claimIds.push(first.id);
  expect(
    await request("/claim", owner.token, { reportId: report.id, evidence }),
    400,
  );
  const second = expect(
    await request("/claim", rival.token, {
      reportId: report.id,
      evidence: "Rival provides different private evidence",
    }),
    201,
  ).claim;
  claimIds.push(second.id);
  const publicReports = expect(await request("/reports", owner.token), 200);
  assert.equal(JSON.stringify(publicReports).includes(evidence), false);
  const privateClaims = expect(await request("/claims", rival.token), 200);
  assert.equal(
    privateClaims.items.some((c: any) => c.claimantId !== rival.id),
    false,
  );
  expect(
    await request("/decision", owner.token, {
      claimId: first.id,
      action: "approve",
      collection: "Cloud test desk",
    }),
    403,
  );
  const decisions = await Promise.all(
    [first, second].map((c) =>
      request("/decision", admin.token, {
        claimId: c.id,
        action: "approve",
        collection: "Student services test desk",
      }),
    ),
  );
  assert.deepEqual(decisions.map((x) => x.status).sort(), [200, 409]);
  const winner = decisions.find((x) => x.status === 200)!.data;
  assert.equal(winner.report.status, "claim approved");
  assert.equal(winner.claim.status, "approved");
  const loser = winner.claim.id === first.id ? second : first;
  expect(
    await request("/decision", admin.token, {
      claimId: loser.id,
      action: "reject",
      reason: "Another claim was verified",
    }),
    200,
  );
  const completed = expect(
    await request("/decision", admin.token, {
      claimId: winner.claim.id,
      action: "complete",
    }),
    200,
  );
  assert.equal(completed.report.status, "returned");
  assert.equal(completed.claim.status, "completed");
  const lost = expect(
    await request("/reports", owner.token, {
      ...fields,
      type: "lost",
      photoKey: undefined,
    }),
    201,
  ).report;
  reportIds.push(lost.id);
  expect(
    await request("/edit", owner.token, {
      ...fields,
      type: "lost",
      title: "[CLOUD SMOKE TEST] Edited calculator",
      reportId: lost.id,
    }),
    200,
  );
  assert.equal(
    expect(await request("/close", owner.token, { reportId: lost.id }), 200)
      .report.status,
    "closed",
  );
  console.log(
    "PASS: private claims, duplicate prevention, concurrent approval conflict, rejection, handover, and related lost report closure",
  );
} finally {
  await signOut().catch(() => {});
  const cleanup = await Promise.allSettled([
    ...claimIds.map((id) =>
      db.send(
        new DeleteCommand({
          TableName: config.TableName,
          Key: { pk: `CLAIM#${id}`, sk: "DATA" },
        }),
      ),
    ),
    ...reportIds.map((id) =>
      db.send(
        new DeleteCommand({
          TableName: config.TableName,
          Key: { pk: `REPORT#${id}`, sk: "DATA" },
        }),
      ),
    ),
    ...(photoKey
      ? [
          s3.send(
            new DeleteObjectCommand({
              Bucket: config.PhotoBucket,
              Key: photoKey,
            }),
          ),
        ]
      : []),
    ...users.map((Username) =>
      cognito.send(
        new AdminDeleteUserCommand({ UserPoolId: config.UserPoolId, Username }),
      ),
    ),
  ]);
  const failures = cleanup.filter((x) => x.status === "rejected");
  if (failures.length) {
    console.error(
      `${failures.length} test cleanup operations failed. Inspect temporary cloud-smoke users and test records.`,
    );
    process.exitCode = 1;
  } else console.log("Temporary cloud test users, records, and image removed.");
}
