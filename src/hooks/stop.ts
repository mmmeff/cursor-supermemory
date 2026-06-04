import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { distillAndStore } from "../distill.ts";
import { readExchanges, latestExchange } from "../transcript.ts";
import { loadSession, saveSession, bufferToTranscript } from "../sessionStore.ts";
import { readStdinText } from "../stdin.ts";

// Distill accumulated turns into memory every N turns. Keeps per-turn cost low
// by batching rather than calling the LLM on every single turn (Hermes-style
// cadence).
const DISTILL_EVERY_N_TURNS = 3;

interface StopInput {
  conversation_id?: string;
  transcript_path?: string;
  workspace_roots?: string[];
  user_email?: string;
}

const ok = () => process.stdout.write(JSON.stringify({ continue: true }));

async function main() {
  const raw = await readStdinText();
  const input: StopInput = JSON.parse(raw);

  const conversationId = input.conversation_id ?? "";
  if (!conversationId || !input.transcript_path) return ok();

  const creds = loadCredentials();
  if (!creds) return ok();

  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const exchange = latestExchange(await readExchanges(input.transcript_path));
  if (!exchange) return ok();

  const session = loadSession(conversationId);
  session.buffer.push(exchange);
  session.turnCount += 1;

  // Batch-distill on the cadence; otherwise just accumulate cheaply.
  if (session.turnCount % DISTILL_EVERY_N_TURNS === 0 && session.buffer.length > 0) {
    const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
    const config = loadConfig(workspaceRoot);
    const apiKey = getApiKey(config);
    if (apiKey) {
      const stored = await distillAndStore(bufferToTranscript(session.buffer), {
        apiKey,
        projectTag: getProjectTag(workspaceRoot, config),
        userTag: getUserTag(config),
      });
      // Only clear the buffer if we actually distilled+stored it; otherwise keep
      // accumulating so nothing is lost when inference is unavailable.
      if (stored) session.buffer = [];
    }
  }

  saveSession(session);
  return ok();
}

main().catch((err) => {
  console.error("[supermemory] stop error:", err);
  ok();
});
