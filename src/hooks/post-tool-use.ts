import { claimPendingRecall } from "../sessionStore.ts";
import { readStdinText } from "../stdin.ts";

interface PostToolUseInput {
  conversation_id?: string;
}

const ok = () => process.stdout.write(JSON.stringify({ continue: true }));

// postToolUse is the only per-turn hook that can inject context
// (additional_context). We use it to deliver the recall that
// beforeSubmitPrompt stashed, exactly once per turn (cleared on inject).
async function main() {
  const raw = await readStdinText();
  const input: PostToolUseInput = JSON.parse(raw);

  const conversationId = input.conversation_id ?? "";
  if (!conversationId) return ok();

  // Atomic claim: only one concurrent tool-call process wins, so recall is
  // injected exactly once per turn even under parallel tool calls.
  const recall = claimPendingRecall(conversationId);
  if (!recall) return ok();

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "postToolUse",
      additionalContext: recall,
    },
  }));
}

main().catch((err) => {
  console.error("[supermemory] post-tool-use error:", err);
  ok();
});
