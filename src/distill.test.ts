import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSections, chunkTranscript, dedupe, writesSucceeded } from "./distill.ts";

describe("distill", () => {
  it("parses project and user sections", () => {
    const parsed = parseSections(`PROJECT:
- use npm run build
USER:
- prefers concise comments`);

    assert.deepEqual(parsed, {
      projectNotes: ["use npm run build"],
      userNotes: ["prefers concise comments"],
    });
  });

  it("ignores NONE sentinels including bullet form", () => {
    const parsed = parseSections(`PROJECT:
- NONE
USER:
NONE`);

    assert.deepEqual(parsed, { projectNotes: [], userNotes: [] });
  });

  it("chunks long transcripts with overlap", () => {
    const transcript = "a".repeat(25);
    const chunks = chunkTranscript(transcript, 10, 2);
    assert.equal(chunks.length, 3);
    assert.equal(chunks[0].length, 10);
    assert.equal(chunks.at(-1)?.endsWith("a"), true);
  });

  it("dedupes case-insensitively", () => {
    assert.deepEqual(dedupe(["Keep", "keep", "Other"]), ["Keep", "Other"]);
  });

  it("writesSucceeded requires all fulfilled writes", () => {
    assert.equal(writesSucceeded([{ status: "fulfilled", value: 1 }]), true);
    assert.equal(
      writesSucceeded([
        { status: "fulfilled", value: 1 },
        { status: "rejected", reason: new Error("fail") },
      ]),
      false,
    );
    assert.equal(writesSucceeded([]), false);
  });
});
