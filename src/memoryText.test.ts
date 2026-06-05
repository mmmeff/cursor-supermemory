import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { memoryBody } from "./memoryText.ts";

describe("memoryText", () => {
  it("prefers memory over other fields", () => {
    assert.equal(
      memoryBody({ memory: "primary", content: "secondary", summary: "tertiary" }),
      "primary",
    );
  });

  it("falls back through content and summary", () => {
    assert.equal(memoryBody({ content: "from content" }), "from content");
    assert.equal(memoryBody({ summary: "from summary" }), "from summary");
  });
});
