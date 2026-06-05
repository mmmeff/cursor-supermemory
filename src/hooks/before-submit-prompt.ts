import { searchRecallForQueries } from "../recall.ts";
import { deriveRecallQueries } from "../recallQueries.ts";
import { clearRecallFile, writeRecallFile } from "../recallFile.ts";
import { resetMidTurnStateForNewPrompt } from "../midTurnRecall.ts";
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

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const session = loadSession(conversationId);
  const queryHash = hashQuery(prompt);
  if (session.pendingRecallQueryHash === queryHash) return hookOk();

  resetMidTurnStateForNewPrompt(session, prompt);

  const derivedQueries = await deriveRecallQueries(prompt);
  const recall = await searchRecallForQueries(
    auth.apiKey,
    auth.projectTag,
    [prompt, ...derivedQueries],
    auth.config,
  );
  if (recall) {
    setPendingRecall(conversationId, recall);
    writeRecallFile(workspaceRoot, recall);
  } else {
    clearPendingRecall(conversationId);
    clearRecallFile(workspaceRoot);
  }
  session.pendingRecallQueryHash = recall ? queryHash : null;
  saveSession(session);

  return hookOk();
}

runHookSafe("before-submit-prompt", main);
