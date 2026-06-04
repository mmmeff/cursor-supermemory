import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";

export interface BufferedTurn {
  user: string;
  assistant: string;
}

export interface SessionState {
  conversationId: string;
  // Hash of the query whose recall is currently pending, so we don't re-search
  // the same prompt.
  pendingRecallQueryHash: string | null;
  // Turns captured but not yet distilled into memory.
  buffer: BufferedTurn[];
  // Total turns seen this session (drives the batch-distill cadence).
  turnCount: number;
}

const SESSIONS_DIR = join(homedir(), ".cursor", ".supermemory", "sessions");

function safeId(conversationId: string): string {
  return conversationId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function sessionPath(conversationId: string): string {
  return join(SESSIONS_DIR, `${safeId(conversationId)}.json`);
}

// Pending recall lives in its own sidecar file (not the JSON) so postToolUse can
// claim it atomically across concurrent hook processes via rename().
function recallPath(conversationId: string): string {
  return join(SESSIONS_DIR, `${safeId(conversationId)}.recall`);
}

export function hashQuery(query: string): string {
  return createHash("sha256").update(query.trim().toLowerCase()).digest("hex").slice(0, 16);
}

export function bufferToTranscript(buffer: BufferedTurn[]): string {
  return buffer.map((t) => `User: ${t.user}\nAssistant: ${t.assistant}`).join("\n");
}

// Stash recall for the next tool call to inject. Overwrites any prior pending
// recall (a new prompt supersedes an un-injected one).
export function setPendingRecall(conversationId: string, recall: string): void {
  if (!conversationId) return;
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    writeFileSync(recallPath(conversationId), recall);
  } catch {
    // best-effort
  }
}

export function clearPendingRecall(conversationId: string): void {
  if (!conversationId) return;
  try {
    rmSync(recallPath(conversationId), { force: true });
  } catch {
    // ignore
  }
}

/**
 * Atomically claim the pending recall. rename() is atomic on POSIX, so when
 * multiple postToolUse processes race, exactly one wins the claim and the
 * others get null — preventing duplicate injection.
 */
export function claimPendingRecall(conversationId: string): string | null {
  if (!conversationId) return null;
  const src = recallPath(conversationId);
  const claimed = `${src}.claimed-${process.pid}`;
  try {
    renameSync(src, claimed);
  } catch {
    return null; // already claimed by another process, or none pending
  }
  try {
    const recall = readFileSync(claimed, "utf-8");
    rmSync(claimed, { force: true });
    return recall || null;
  } catch {
    return null;
  }
}

function emptyState(conversationId: string): SessionState {
  return {
    conversationId,
    pendingRecallQueryHash: null,
    buffer: [],
    turnCount: 0,
  };
}

export function loadSession(conversationId: string): SessionState {
  if (!conversationId) return emptyState(conversationId);
  const path = sessionPath(conversationId);
  if (!existsSync(path)) return emptyState(conversationId);
  try {
    const raw = JSON.parse(readFileSync(path, "utf-8"));
    return { ...emptyState(conversationId), ...raw, conversationId };
  } catch {
    return emptyState(conversationId);
  }
}

export function saveSession(state: SessionState): void {
  if (!state.conversationId) return;
  try {
    mkdirSync(SESSIONS_DIR, { recursive: true });
    writeFileSync(sessionPath(state.conversationId), JSON.stringify(state));
  } catch {
    // Best-effort: a missing scratch file just degrades to no per-turn recall.
  }
}

export function clearSession(conversationId: string): void {
  if (!conversationId) return;
  try {
    rmSync(sessionPath(conversationId), { force: true });
    rmSync(recallPath(conversationId), { force: true });
  } catch {
    // ignore
  }
}
