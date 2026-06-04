import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { createClient } from "../client.ts";
import { formatContext } from "../context.ts";
import { saveSession, loadSession } from "../sessionStore.ts";
import { readStdinText } from "../stdin.ts";

interface SessionStartInput {
  workspace_roots: string[];
  user_email?: string;
  session_id: string;
  conversation_id?: string;
}

// Ambient recall at session start: user profile + a few most-recent project
// notes ("who you are + where we left off"). Query-scoped recall happens
// per-turn via before-submit-prompt + post-tool-use, seeded by the actual
// prompt — sessionStart has no prompt to search with.
const RECENT_PROJECT_NOTES = 5;

const ok = () => process.stdout.write(JSON.stringify({ continue: true }));

async function main() {
  const raw = await readStdinText();
  const input: SessionStartInput = JSON.parse(raw);

  const creds = loadCredentials();
  if (!creds) return ok();

  const config = loadConfig(input.workspace_roots[0]);
  const apiKey = getApiKey(config);
  if (!apiKey) return ok();

  // Inject user email from input for tag resolution
  if (input.user_email && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = input.user_email;
  }

  const userTag = getUserTag(config);
  const projectTag = getProjectTag(input.workspace_roots[0] || process.cwd(), config);

  // Initialize (or carry over) the per-session scratch state used by the
  // per-turn recall/capture hooks.
  const conversationId = input.conversation_id ?? input.session_id ?? "";
  if (conversationId) saveSession(loadSession(conversationId));

  // Use documents.list (recency-ordered) rather than search.memories: the v4
  // search endpoint rejects the empty query we'd need to "list everything".
  const [profileResult, memoriesResult] = await Promise.allSettled([
    createClient(apiKey, userTag).profile({ containerTag: userTag }),
    createClient(apiKey, projectTag).documents.list({ containerTags: [projectTag], limit: RECENT_PROJECT_NOTES }),
  ]);

  const profile = profileResult.status === "fulfilled" ? profileResult.value.profile : null;
  const memories =
    memoriesResult.status === "fulfilled" ? (memoriesResult.value.memories ?? []) : [];

  const context = formatContext(profile, memories);
  if (!context) return ok();

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "sessionStart",
      additionalContext: context,
    },
  }));
}

main().catch((err) => {
  console.error("[supermemory] session-start error:", err);
  ok();
});
