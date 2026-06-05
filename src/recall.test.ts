import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeMemoryHits } from "./recall.ts";

describe("recall", () => {
  it("merges duplicate memories keeping the highest similarity", () => {
    const merged = mergeMemoryHits([
      { memory: "uses vitest", similarity: 0.4 },
      { memory: "uses vitest", similarity: 0.8 },
      { memory: "prefers bun", similarity: 0.6 },
    ]);

    assert.equal(merged.length, 2);
    assert.equal(merged[0]?.memory, "uses vitest");
    assert.equal(merged[0]?.similarity, 0.8);
    assert.equal(merged[1]?.memory, "prefers bun");
  });
});
