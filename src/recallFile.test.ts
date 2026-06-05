import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { tmpdir } from "node:os";
import {
  RECALL_DIR,
  RECALL_FILENAME,
  clearRecallFile,
  getLegacyRecallFilePath,
  getRecallFilePath,
  resolveRecallFilePathForLookup,
  withRecallFileHeader,
  writeRecallFile,
} from "./recallFile.ts";
import { safeConversationId } from "./sessionStore.ts";

describe("recallFile", () => {
  it("writes and clears recall under ~/.cursor/.supermemory/recall/{projectTag}/{conversationId}", () => {
    const projectTag = "cursor_project_test123456";
    const conversationId = "conv-abc-123";
    const filePath = getRecallFilePath(projectTag, conversationId);

    assert.equal(
      filePath,
      join(RECALL_DIR, projectTag, safeConversationId(conversationId), RECALL_FILENAME),
    );
    assert.ok(filePath.startsWith(homedir()));

    writeRecallFile(projectTag, conversationId, "[SUPERMEMORY RECALL]\n- test memory");
    assert.ok(existsSync(filePath));
    assert.match(readFileSync(filePath, "utf-8"), /test memory/);

    clearRecallFile(projectTag, conversationId);
    assert.ok(!existsSync(filePath));
  });

  it("removes legacy workspace recall files when writing to the home path", () => {
    const workspace = mkdtempSync(join(tmpdir(), "supermemory-recall-"));
    const projectTag = "cursor_project_legacycleanup";
    const conversationId = "conv-legacy";
    const legacyPath = getLegacyRecallFilePath(workspace);

    writeRecallFile(projectTag, conversationId, "recall", workspace);
    assert.ok(!existsSync(legacyPath));
  });

  it("prefixes injected recall with the absolute file path", () => {
    const path = "/tmp/recall/current-recall.md";
    const wrapped = withRecallFileHeader(path, "[SUPERMEMORY RECALL]\n- item");
    assert.match(wrapped, /^Supermemory recall file: \/tmp\/recall\/current-recall\.md/);
    assert.match(wrapped, /- item/);
  });

  it("resolves an exact path when conversationId is provided", () => {
    const projectTag = "cursor_project_lookup";
    const conversationId = "conv-exact";
    const resolved = resolveRecallFilePathForLookup(projectTag, conversationId);
    assert.equal(resolved.recallFilePath, getRecallFilePath(projectTag, conversationId));
    assert.equal(resolved.ambiguous, false);
  });

  it("returns ambiguous when multiple recent recall files exist", () => {
    const projectTag = "cursor_project_ambiguous";
    const projectDir = join(RECALL_DIR, projectTag);
    mkdirSync(join(projectDir, "conv_a"), { recursive: true });
    mkdirSync(join(projectDir, "conv_b"), { recursive: true });
    writeFileSync(join(projectDir, "conv_a", RECALL_FILENAME), "a");
    writeFileSync(join(projectDir, "conv_b", RECALL_FILENAME), "b");

    const resolved = resolveRecallFilePathForLookup(projectTag);
    assert.equal(resolved.recallFilePath, null);
    assert.equal(resolved.ambiguous, true);
    assert.equal(resolved.candidates.length, 2);
  });
});
