import { test } from "node:test";
import assert from "node:assert/strict";
import { readConfig } from "../src/config";
test("AWS mode fails closed on missing or invalid configuration", () => {
  assert.equal(readConfig({}).demo, true);
  assert.throws(() => readConfig({ VITE_MODE: "awss" }), /VITE_MODE/);
  assert.throws(() => readConfig({ VITE_MODE: "aws" }), /missing/);
  const env = {
    VITE_MODE: "aws",
    VITE_CAMPUS_DOMAIN: "COLLEGE.EDU",
    VITE_API_URL: "https://api.example.com/",
    VITE_USER_POOL_ID: "ap-south-1_test",
    VITE_USER_POOL_CLIENT_ID: "client",
  };
  const config = readConfig(env);
  assert.equal(config.demo, false);
  assert.equal(config.domain, "college.edu");
  assert.equal(config.apiUrl, "https://api.example.com");
  assert.throws(
    () => readConfig({ ...env, VITE_API_URL: "http://api.example.com" }),
    /HTTPS/,
  );
});
