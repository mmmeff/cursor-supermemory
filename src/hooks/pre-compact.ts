import { loadSession, saveSession } from "../sessionStore.ts";
import { flushSessionBuffer, hookOk, readHookInput, resolveHookAuth, runHookSafe } from "../hookRuntime.ts";

interface PreCompactInput {
  conversation_id?: string;
  workspace_roots?: string[];
  user_email?: string;
}

async function main() {
  const input = await readHookInput<PreCompactInput>();

  const conversationId = input.conversation_id ?? "";
  if (!conversationId) return hookOk();

  const session = loadSession(conversationId);
  if (!session.buffer.length) return hookOk();

  const auth = resolveHookAuth(input);
  if (!auth) return hookOk();

  if (await flushSessionBuffer(session, auth)) {
    saveSession(session);
  }

  return hookOk();
}

runHookSafe("pre-compact", main);
