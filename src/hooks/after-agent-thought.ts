import { syncGenerationSession } from "../midTurnRecall.ts";
import { loadSession, saveSession } from "../sessionStore.ts";
import { hookOk, readHookInput, runHookSafe } from "../hookRuntime.ts";

interface AfterAgentThoughtInput {
  conversation_id?: string;
  generation_id?: string;
  text?: string;
}

const MAX_THOUGHT_SNIPPET = 2000;

async function main() {
  const input = await readHookInput<AfterAgentThoughtInput>();

  const conversationId = input.conversation_id ?? "";
  const thought = (input.text ?? "").trim();
  if (!conversationId || !thought) return hookOk();

  const session = loadSession(conversationId);
  const generationId = input.generation_id ?? "";
  if (generationId) syncGenerationSession(session, generationId);

  session.thoughtSnippet = thought.slice(0, MAX_THOUGHT_SNIPPET);
  saveSession(session);

  return hookOk();
}

runHookSafe("after-agent-thought", main);
