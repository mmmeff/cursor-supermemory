import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { safeConversationId } from "./sessionStore.ts";

export const RECALL_DIR = join(homedir(), ".cursor", ".supermemory", "recall");
export const RECALL_FILENAME = "current-recall.md";
export const RECALL_PATH_PREFIX = "Supermemory recall file:";

/** Legacy workspace-relative path (pre–home-dir recall). */
export const LEGACY_RECALL_FILE_REL = join(".cursor", ".supermemory", RECALL_FILENAME);

const RECALL_LOOKUP_MAX_AGE_MS = 120_000;

export function getRecallFilePath(projectTag: string, conversationId: string): string {
  return join(RECALL_DIR, projectTag, safeConversationId(conversationId), RECALL_FILENAME);
}

export function getLegacyRecallFilePath(workspaceRoot: string): string {
  return join(workspaceRoot, LEGACY_RECALL_FILE_REL);
}

export function withRecallFileHeader(filePath: string, content: string): string {
  if (content.includes(RECALL_PATH_PREFIX)) return content;
  return `${RECALL_PATH_PREFIX} ${filePath}\n\n${content}`;
}

export function listRecentRecallFilePaths(projectTag: string, maxAgeMs = RECALL_LOOKUP_MAX_AGE_MS): string[] {
  const projectDir = join(RECALL_DIR, projectTag);
  if (!existsSync(projectDir)) return [];

  const now = Date.now();
  const paths: string[] = [];

  for (const entry of readdirSync(projectDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const filePath = join(projectDir, entry.name, RECALL_FILENAME);
    if (!existsSync(filePath)) continue;
    if (now - statSync(filePath).mtimeMs > maxAgeMs) continue;
    paths.push(filePath);
  }

  return paths.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
}

export function resolveRecallFilePathForLookup(
  projectTag: string,
  conversationId?: string,
  maxAgeMs = RECALL_LOOKUP_MAX_AGE_MS,
): {
  recallFilePath: string | null;
  ambiguous: boolean;
  candidates: string[];
} {
  if (conversationId) {
    return {
      recallFilePath: getRecallFilePath(projectTag, conversationId),
      ambiguous: false,
      candidates: [],
    };
  }

  const candidates = listRecentRecallFilePaths(projectTag, maxAgeMs);
  if (candidates.length === 1) {
    return { recallFilePath: candidates[0], ambiguous: false, candidates };
  }

  return {
    recallFilePath: null,
    ambiguous: candidates.length > 1,
    candidates,
  };
}

export function writeRecallFile(
  projectTag: string,
  conversationId: string,
  content: string,
  workspaceRoot?: string,
): void {
  const filePath = getRecallFilePath(projectTag, conversationId);
  try {
    mkdirSync(join(RECALL_DIR, projectTag, safeConversationId(conversationId)), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    clearLegacyRecallPaths(projectTag, workspaceRoot);
  } catch {
    // best-effort
  }
}

export function clearRecallFile(
  projectTag: string,
  conversationId: string,
  workspaceRoot?: string,
): void {
  try {
    rmSync(getRecallFilePath(projectTag, conversationId), { force: true });
  } catch {
    // best-effort
  }
  clearLegacyRecallPaths(projectTag, workspaceRoot);
}

function clearLegacyRecallPaths(projectTag: string, workspaceRoot?: string): void {
  try {
    rmSync(join(RECALL_DIR, projectTag, RECALL_FILENAME), { force: true });
  } catch {
    // best-effort
  }
  if (workspaceRoot) {
    try {
      rmSync(getLegacyRecallFilePath(workspaceRoot), { force: true });
    } catch {
      // best-effort
    }
  }
}
