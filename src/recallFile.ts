import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Workspace-relative path; must stay in sync with rules/supermemory.mdc */
export const RECALL_FILE_REL = join(".cursor", ".supermemory", "current-recall.md");

export function getRecallFilePath(workspaceRoot: string): string {
  return join(workspaceRoot, RECALL_FILE_REL);
}

export function writeRecallFile(workspaceRoot: string, content: string): void {
  const filePath = getRecallFilePath(workspaceRoot);
  try {
    mkdirSync(join(workspaceRoot, ".cursor", ".supermemory"), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
  } catch {
    // best-effort
  }
}

export function clearRecallFile(workspaceRoot: string): void {
  try {
    rmSync(getRecallFilePath(workspaceRoot), { force: true });
  } catch {
    // best-effort
  }
}
