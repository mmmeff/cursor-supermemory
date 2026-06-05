import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DERIVED_RECALL_QUERY_COUNT,
  buildMidTurnRecallQueryPrompt,
  buildRecallQueryPrompt,
  parseDerivedRecallQueries,
} from "./recallQueries.ts";

describe("recallQueries", () => {
  it("builds a mid-turn prompt from trajectory context", () => {
    const prompt = buildMidTurnRecallQueryPrompt("User message:\nfix hooks\n\nRecent tool activity:\n- Read(a.ts)");
    assert.match(prompt, /current trajectory/);
    assert.match(prompt, /fix hooks/);
  });

  it("builds a prompt asking for two derived queries", () => {
    const prompt = buildRecallQueryPrompt("fix the auth hook race");
    assert.match(prompt, /exactly 2 short semantic search queries/);
    assert.match(prompt, /fix the auth hook race/);
    assert.match(prompt, /ONLY valid JSON/);
  });

  it("parses JSON query arrays", () => {
    assert.deepEqual(
      parseDerivedRecallQueries('{"queries":["auth hook timing","sessionStart race"]}'),
      ["auth hook timing", "sessionStart race"],
    );
  });

  it("extracts JSON from surrounding text", () => {
    assert.deepEqual(parseDerivedRecallQueries('Here you go:\n{"queries":["a","b"]}\n'), ["a", "b"]);
  });

  it("dedupes and caps derived queries", () => {
    const queries = Array.from({ length: 5 }, (_, i) => `query ${i}`);
    assert.deepEqual(parseDerivedRecallQueries(JSON.stringify({ queries })).length, DERIVED_RECALL_QUERY_COUNT);
    assert.deepEqual(parseDerivedRecallQueries('{"queries":["Same"," same "]}'), ["Same"]);
  });

  it("returns empty for invalid payloads", () => {
    assert.deepEqual(parseDerivedRecallQueries(""), []);
    assert.deepEqual(parseDerivedRecallQueries("not json"), []);
    assert.deepEqual(parseDerivedRecallQueries('{"items":["a"]}'), []);
  });
});
