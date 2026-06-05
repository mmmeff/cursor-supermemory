import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseAgentStatusJson } from "./agentCli.ts";

describe("agentCli", () => {
  it("parses authenticated agent status JSON", () => {
    const parsed = parseAgentStatusJson(`{
      "status": "authenticated",
      "isAuthenticated": true,
      "userInfo": { "email": "dev@example.com" }
    }`);

    assert.deepEqual(parsed, { authenticated: true, email: "dev@example.com" });
  });

  it("parses unauthenticated agent status JSON", () => {
    const parsed = parseAgentStatusJson(`{
      "status": "unauthenticated",
      "isAuthenticated": false
    }`);

    assert.deepEqual(parsed, { authenticated: false, email: undefined });
  });

  it("returns null for invalid agent status JSON", () => {
    assert.equal(parseAgentStatusJson("not json"), null);
  });
});
