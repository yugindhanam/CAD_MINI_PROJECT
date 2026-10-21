import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { seed } from "../src/seed";
import { claimItem, type Claim, type Report } from "../src/domain";

test("API enforces private access, administrator authorization, and conditional approval writes", async () => {
  process.env.AWS_REGION = "us-east-1";
  process.env.TABLE_NAME = "test-records";
  const { handler } = await import("../backend/handler");
  const report = seed().reports[0];
  const a = claimItem(
    report,
    { id: "alice", email: "alice@campus.edu", admin: false },
    "Alice knows the hidden serial number",
  );
  const b = claimItem(
    report,
    { id: "bob", email: "bob@campus.edu", admin: false },
    "Bob knows a different hidden detail",
  );
  const records = new Map<string, Report | Claim>([
    [`REPORT#${report.id}`, report],
    [`CLAIM#${a.id}`, a],
    [`CLAIM#${b.id}`, b],
  ]);
  let transactionCount = 0;
  const spy = mock.method(
    DynamoDBDocumentClient.prototype,
    "send",
    async (command: any) => {
      const p = command.input;
      if (command.constructor.name === "GetCommand")
        return { Item: { data: structuredClone(records.get(p.Key.pk)) } };
      if (command.constructor.name === "QueryCommand") {
        assert.equal(p.IndexName, "ByOwner");
        assert.equal(p.ExpressionAttributeValues[":p"], "alice");
        // Defense in depth: even an unexpected row from a query is filtered.
        return { Items: [{ data: a }, { data: b }] };
      }
      if (command.constructor.name === "TransactWriteCommand") {
        transactionCount++;
        assert.equal(p.TransactItems.length, 2);
        for (const item of p.TransactItems) {
          const put = item.Put;
          assert.equal(put.ConditionExpression, "#d.#v = :v");
          const old = records.get(put.Item.pk)!;
          if (old.version !== put.ExpressionAttributeValues[":v"]) {
            const error = new Error("Conditional conflict");
            error.name = "TransactionCanceledException";
            throw error;
          }
        }
        for (const item of p.TransactItems)
          records.set(item.Put.Item.pk, structuredClone(item.Put.Item.data));
        return {};
      }
      throw Error("Unexpected database operation");
    },
  );
  const event = (id: string, admin: boolean, path: string, body?: unknown) => ({
    rawPath: path,
    body: body ? JSON.stringify(body) : undefined,
    requestContext: {
      http: { method: body ? "POST" : "GET" },
      authorizer: {
        jwt: {
          claims: { sub: id, "cognito:groups": admin ? "Administrators" : "" },
        },
      },
    },
  });
  try {
    const privatePage = await handler(event("alice", false, "/claims"));
    assert.deepEqual(
      JSON.parse(privatePage.body).items.map((x: Claim) => x.claimantId),
      ["alice"],
    );
    const denied = await handler(
      event("alice", false, "/decision", {
        claimId: a.id,
        action: "approve",
        collection: "Library desk",
        admin: true,
      }),
    );
    assert.equal(denied.statusCode, 400);
    assert.equal(transactionCount, 0);
    const [first, second] = await Promise.all(
      [a, b].map((c) =>
        handler(
          event("admin", true, "/decision", {
            claimId: c.id,
            action: "approve",
            collection: "Library desk",
          }),
        ),
      ),
    );
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
    assert.equal(transactionCount, 2);
    assert.equal(records.get(`REPORT#${report.id}`)?.status, "claim approved");
    assert.equal(
      [...records.values()].filter((x) => x.status === "approved").length,
      1,
    );
    const anonymous = await handler({
      rawPath: "/reports",
      requestContext: { http: { method: "GET" } },
    });
    assert.equal(anonymous.statusCode, 401);
  } finally {
    spy.mock.restore();
  }
});
