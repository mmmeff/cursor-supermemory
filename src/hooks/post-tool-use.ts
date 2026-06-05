import { claimPendingRecall } from "../sessionStore.ts";
import { hookOk, readHookInput, runHookSafe } from "../hookRuntime.ts";

interface PostToolUseInput {
  conversation_id?: string;
}

async function main() {
  const input = await readHookInput<PostToolUseInput>();

  const conversationId = input.conversation_id ?? "";
  if (!conversationId) return hookOk();

  const recall = claimPendingRecall(conversationId);
  if (!recall) return hookOk();

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "postToolUse",
      additionalContext: recall,
    },
  }));
}

runHookSafe("post-tool-use", main);
