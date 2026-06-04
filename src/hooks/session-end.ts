import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { distillAndStore } from "../distill.ts";
import { readExchanges } from "../transcript.ts";
import { loadSession, clearSession, bufferToTranscript } from "../sessionStore.ts";
import { readStdinText } from "../stdin.ts";

interface SessionEndInput {
  session_id?: string;
  conversation_id?: string;
  transcript_path?: string;
  reason?: string;
  workspace_roots?: string[];
}

async function main() {
  const raw = await readStdinText();
  const input: SessionEndInput = JSON.parse(raw);

  // Persist on any normal session end. Skip abnormal terminations.
  const NON_PERSISTABLE_REASONS = new Set(["aborted", "error"]);
  if (NON_PERSISTABLE_REASONS.has(input.reason ?? "")) return;

  const conversationId = input.conversation_id ?? input.session_id ?? "";

  const creds = loadCredentials();
  if (!creds) return;

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) {
    clearSession(conversationId);
    return;
  }

  // Final sweep: distill whatever incremental capture left in the buffer. If
  // nothing was buffered (capture hooks never fired this session), fall back to
  // the full transcript so we still capture the session.
  const session = loadSession(conversationId);
  let transcript = bufferToTranscript(session.buffer);
  if (!transcript && input.transcript_path) {
    const exchanges = await readExchanges(input.transcript_path);
    const userTurns = exchanges.filter((e) => e.role === "user");
    if (userTurns.length >= 2) {
      transcript = exchanges.map((e) => `${e.role === "user" ? "User" : "Assistant"}: ${e.text}`).join("\n");
    }
  }

  if (transcript) {
    await distillAndStore(transcript, {
      apiKey,
      projectTag: getProjectTag(workspaceRoot, config),
      userTag: getUserTag(config),
    });
  }

  clearSession(conversationId);
}

main().catch((err) => {
  console.error("[supermemory] session-end error:", err);
});
