import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const RECALL_DIR = join(homedir(), ".cursor", ".supermemory", "recall");
export const RECALL_FILENAME = "current-recall.md";

/** Legacy workspace-relative path (pre–home-dir recall). */
export const LEGACY_RECALL_FILE_REL = join(".cursor", ".supermemory", RECALL_FILENAME);

export function getRecallFilePath(projectTag: string): string {
  return join(RECALL_DIR, projectTag, RECALL_FILENAME);
}

export function getLegacyRecallFilePath(workspaceRoot: string): string {
  return join(workspaceRoot, LEGACY_RECALL_FILE_REL);
}

export function writeRecallFile(projectTag: string, content: string, workspaceRoot?: string): void {
  const filePath = getRecallFilePath(projectTag);
  try {
    mkdirSync(join(RECALL_DIR, projectTag), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    if (workspaceRoot) clearLegacyRecallFile(workspaceRoot);
  } catch {
    // best-effort
  }
}

export function clearRecallFile(projectTag: string, workspaceRoot?: string): void {
  try {
    rmSync(getRecallFilePath(projectTag), { force: true });
  } catch {
    // best-effort
  }
  if (workspaceRoot) clearLegacyRecallFile(workspaceRoot);
}

function clearLegacyRecallFile(workspaceRoot: string): void {
  try {
    rmSync(getLegacyRecallFilePath(workspaceRoot), { force: true });
  } catch {
    // best-effort
  }
}
