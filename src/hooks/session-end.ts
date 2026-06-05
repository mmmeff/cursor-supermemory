import { distillAndStore } from "../distill.ts";
import { readExchanges, exchangesToTranscript } from "../transcript.ts";
import { loadSession, clearSession, bufferToTranscript } from "../sessionStore.ts";
import { applyUserEmail, resolveAuth } from "../authContext.ts";
import { loadCredentials } from "../auth.ts";
import { readHookInput, runHookSafe } from "../hookRuntime.ts";

interface SessionEndInput {
  session_id?: string;
  conversation_id?: string;
  transcript_path?: string;
  reason?: string;
  workspace_roots?: string[];
  user_email?: string;
}

async function main() {
  const input = await readHookInput<SessionEndInput>();

  const NON_PERSISTABLE_REASONS = new Set(["aborted", "error"]);
  if (NON_PERSISTABLE_REASONS.has(input.reason ?? "")) return;

  const conversationId = input.conversation_id ?? input.session_id ?? "";
  if (!loadCredentials()) return;

  applyUserEmail(input.user_email);
  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const auth = resolveAuth(workspaceRoot);
  if (!auth) {
    clearSession(conversationId);
    return;
  }

  const session = loadSession(conversationId);
  let transcript = bufferToTranscript(session.buffer);
  if (!transcript && input.transcript_path) {
    const exchanges = await readExchanges(input.transcript_path);
    const userTurns = exchanges.filter((e) => e.role === "user");
    if (userTurns.length >= 2) {
      transcript = exchangesToTranscript(exchanges);
    }
  }

  if (transcript) {
    await distillAndStore(transcript, {
      apiKey: auth.apiKey,
      projectTag: auth.projectTag,
      userTag: auth.userTag,
    });
  }

  clearSession(conversationId);
}

runHookSafe("session-end", main);
