import { searchRecall } from "../recall.ts";
import { loadSession, saveSession, hashQuery, setPendingRecall, clearPendingRecall } from "../sessionStore.ts";
import { hookOk, readHookInput, resolveHookAuth, runHookSafe } from "../hookRuntime.ts";

interface BeforeSubmitPromptInput {
  conversation_id?: string;
  prompt?: string;
  workspace_roots?: string[];
  user_email?: string;
}

async function main() {
  const input = await readHookInput<BeforeSubmitPromptInput>();

  const conversationId = input.conversation_id ?? "";
  const prompt = (input.prompt ?? "").trim();
  if (!conversationId || !prompt) return hookOk();

  const auth = resolveHookAuth(input);
  if (!auth) return hookOk();

  const session = loadSession(conversationId);
  const queryHash = hashQuery(prompt);
  if (session.pendingRecallQueryHash === queryHash) return hookOk();

  const recall = await searchRecall(auth.apiKey, auth.projectTag, prompt, auth.config);
  if (recall) setPendingRecall(conversationId, recall);
  else clearPendingRecall(conversationId);
  session.pendingRecallQueryHash = recall ? queryHash : null;
  saveSession(session);

  return hookOk();
}

runHookSafe("before-submit-prompt", main);
