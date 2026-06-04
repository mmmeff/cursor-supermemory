import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getProjectTag } from "../tags.ts";
import { searchRecall } from "../recall.ts";
import { loadSession, saveSession, hashQuery, setPendingRecall, clearPendingRecall } from "../sessionStore.ts";
import { readStdinText } from "../stdin.ts";

interface BeforeSubmitPromptInput {
  conversation_id?: string;
  prompt?: string;
  workspace_roots?: string[];
  user_email?: string;
}

const ok = () => process.stdout.write(JSON.stringify({ continue: true }));

// beforeSubmitPrompt cannot inject context (only continue/user_message), so we
// run query-scoped recall here and STASH it for post-tool-use to inject.
async function main() {
  const raw = await readStdinText();
  const input: BeforeSubmitPromptInput = JSON.parse(raw);

  const conversationId = input.conversation_id ?? "";
  const prompt = (input.prompt ?? "").trim();
  if (!conversationId || !prompt) return ok();

  const creds = loadCredentials();
  if (!creds) return ok();

  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) return ok();

  const session = loadSession(conversationId);
  const queryHash = hashQuery(prompt);

  // Skip duplicate searches for the same prompt.
  if (session.pendingRecallQueryHash === queryHash) return ok();

  const projectTag = getProjectTag(workspaceRoot, config);
  const recall = await searchRecall(apiKey, projectTag, prompt);

  if (recall) setPendingRecall(conversationId, recall);
  else clearPendingRecall(conversationId);
  session.pendingRecallQueryHash = recall ? queryHash : null;
  saveSession(session);

  return ok();
}

main().catch((err) => {
  console.error("[supermemory] before-submit-prompt error:", err);
  ok();
});
