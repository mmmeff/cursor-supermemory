import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  clearRecallFile,
  getRecallFilePath,
  RECALL_FILE_REL,
  writeRecallFile,
} from "./recallFile.ts";

describe("recallFile", () => {
  it("writes and clears recall under .cursor/.supermemory", () => {
    const workspace = mkdtempSync(join(tmpdir(), "supermemory-recall-"));
    const filePath = getRecallFilePath(workspace);

    assert.equal(filePath, join(workspace, RECALL_FILE_REL));

    writeRecallFile(workspace, "[SUPERMEMORY RECALL]\n- test memory");
    assert.ok(existsSync(filePath));
    assert.match(readFileSync(filePath, "utf-8"), /test memory/);

    clearRecallFile(workspace);
    assert.ok(!existsSync(filePath));
  });
});
