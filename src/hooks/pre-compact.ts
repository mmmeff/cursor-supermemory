import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { distillAndStore } from "../distill.ts";
import { loadSession, saveSession, bufferToTranscript } from "../sessionStore.ts";
import { readStdinText } from "../stdin.ts";

interface PreCompactInput {
  conversation_id?: string;
  workspace_roots?: string[];
  user_email?: string;
}

const ok = () => process.stdout.write(JSON.stringify({ continue: true }));

// Context is about to be compacted — flush whatever turns we've buffered into
// memory now so insights aren't lost. (One of the few hooks that also runs on
// cloud agents.)
async function main() {
  const raw = await readStdinText();
  const input: PreCompactInput = JSON.parse(raw);

  const conversationId = input.conversation_id ?? "";
  if (!conversationId) return ok();

  const session = loadSession(conversationId);
  if (!session.buffer.length) return ok();

  const creds = loadCredentials();
  if (!creds) return ok();

  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) return ok();

  const stored = await distillAndStore(bufferToTranscript(session.buffer), {
    apiKey,
    projectTag: getProjectTag(workspaceRoot, config),
    userTag: getUserTag(config),
  });
  if (stored) {
    session.buffer = [];
    saveSession(session);
  }

  return ok();
}

main().catch((err) => {
  console.error("[supermemory] pre-compact error:", err);
  ok();
});
