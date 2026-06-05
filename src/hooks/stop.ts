import { readExchanges, latestExchange } from "../transcript.ts";
import { loadSession, saveSession } from "../sessionStore.ts";
import { flushSessionBuffer, hookOk, readHookInput, resolveHookAuth, runHookSafe } from "../hookRuntime.ts";

const DISTILL_EVERY_N_TURNS = 3;

interface StopInput {
  conversation_id?: string;
  transcript_path?: string;
  workspace_roots?: string[];
  user_email?: string;
}

async function main() {
  const input = await readHookInput<StopInput>();

  const conversationId = input.conversation_id ?? "";
  if (!conversationId || !input.transcript_path) return hookOk();

  const auth = resolveHookAuth(input);
  if (!auth) return hookOk();

  const exchange = latestExchange(await readExchanges(input.transcript_path));
  if (!exchange) return hookOk();

  const session = loadSession(conversationId);
  session.buffer.push(exchange);
  session.turnCount += 1;

  if (session.turnCount % DISTILL_EVERY_N_TURNS === 0 && session.buffer.length > 0) {
    await flushSessionBuffer(session, auth);
  }

  saveSession(session);
  return hookOk();
}

runHookSafe("stop", main);
