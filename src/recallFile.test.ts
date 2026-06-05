import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import {
  RECALL_DIR,
  RECALL_FILENAME,
  clearRecallFile,
  getLegacyRecallFilePath,
  getRecallFilePath,
  writeRecallFile,
} from "./recallFile.ts";

describe("recallFile", () => {
  it("writes and clears recall under ~/.cursor/.supermemory/recall/{projectTag}", () => {
    const projectTag = "cursor_project_test123456";
    const filePath = getRecallFilePath(projectTag);

    assert.equal(filePath, join(RECALL_DIR, projectTag, RECALL_FILENAME));
    assert.ok(filePath.startsWith(homedir()));

    writeRecallFile(projectTag, "[SUPERMEMORY RECALL]\n- test memory");
    assert.ok(existsSync(filePath));
    assert.match(readFileSync(filePath, "utf-8"), /test memory/);

    clearRecallFile(projectTag);
    assert.ok(!existsSync(filePath));
  });

  it("removes legacy workspace recall files when writing to the home path", () => {
    const workspace = mkdtempSync(join(tmpdir(), "supermemory-recall-"));
    const projectTag = "cursor_project_legacycleanup";
    const legacyPath = getLegacyRecallFilePath(workspace);

    writeRecallFile(projectTag, "recall", workspace);
    assert.ok(!existsSync(legacyPath));
  });
});
