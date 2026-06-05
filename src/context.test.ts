import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coerceProfile, formatContext } from "./context.ts";

describe("context", () => {
  it("coerces profile arrays from API-shaped objects", () => {
    assert.deepEqual(coerceProfile({ static: ["likes tabs"], dynamic: [1, "x"] }), {
      static: ["likes tabs"],
      dynamic: ["x"],
    });
  });

  it("returns null for empty profile payloads", () => {
    assert.equal(coerceProfile({ static: [], dynamic: [] }), null);
  });

  it("formats profile and memories into context block", () => {
    const context = formatContext({ static: ["prefers bun"] }, [{ memory: "uses vitest" }]);
    assert.match(context, /\[SUPERMEMORY CONTEXT\]/);
    assert.match(context, /prefers bun/);
    assert.match(context, /uses vitest/);
  });
});
