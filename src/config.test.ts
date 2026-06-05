import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseConfigFields } from "./config.ts";

describe("config", () => {
  it("picks only known config keys", () => {
    const parsed = parseConfigFields({
      maxMemories: 12,
      similarityThreshold: 0.4,
      typoField: "ignored",
      injectProfile: false,
    });

    assert.deepEqual(parsed, {
      maxMemories: 12,
      similarityThreshold: 0.4,
      injectProfile: false,
    });
  });

  it("ignores invalid value types", () => {
    const parsed = parseConfigFields({
      maxMemories: "10",
      injectProfile: "yes",
    });

    assert.deepEqual(parsed, {});
  });
});
