import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "../backend/preSignup";
test("signup requires exactly the configured campus domain and leaves email verification to Cognito", async () => {
  process.env.CAMPUS_DOMAIN = "college.edu";
  const event = {
    request: { userAttributes: { email: "student@COLLEGE.EDU" } },
    response: {},
  };
  assert.equal(await handler(event), event);
  assert.deepEqual(event.response, {});
  await assert.rejects(
    handler({
      request: {
        userAttributes: { email: "student@college.edu.attacker.com" },
      },
    }),
  );
  await assert.rejects(
    handler({ request: { userAttributes: { email: "student@example.com" } } }),
  );
});
