import { createClient } from "../client.ts";
import { formatContext, coerceProfile } from "../context.ts";
import { getRecallFilePath } from "../recallFile.ts";
import { loadSession, saveSession } from "../sessionStore.ts";
import { hookOk, readHookInput, resolveHookAuth, runHookSafe } from "../hookRuntime.ts";
import { coerceMemoryDocuments } from "../memoryText.ts";
import type { MemoryDocument } from "../memoryText.ts";
import type { ProfileSummary } from "../context.ts";

interface SessionStartInput {
  workspace_roots: string[];
  user_email?: string;
  session_id: string;
  conversation_id?: string;
}

async function main() {
  const input = await readHookInput<SessionStartInput>();
  const auth = resolveHookAuth(input);
  if (!auth) return hookOk();

  const conversationId = input.conversation_id ?? input.session_id ?? "";
  if (conversationId) saveSession(loadSession(conversationId));

  let profile: ProfileSummary | null = null;
  let memories: MemoryDocument[] = [];

  const profilePromise = auth.config.injectProfile
    ? createClient(auth.apiKey, auth.userTag)
        .profile({ containerTag: auth.userTag })
        .then((result) => {
          profile = coerceProfile(result.profile);
        })
        .catch(() => {})
    : Promise.resolve();

  const memoriesPromise = createClient(auth.apiKey, auth.projectTag)
    .documents.list({ containerTags: [auth.projectTag], limit: auth.config.maxProjectMemories })
    .then((result) => {
      memories = coerceMemoryDocuments(result.memories);
    })
    .catch(() => {});

  await Promise.all([profilePromise, memoriesPromise]);

  const context = formatContext(profile, memories);
  const recallFilePath = conversationId
    ? getRecallFilePath(auth.projectTag, conversationId)
    : null;

  const lines: string[] = [];
  if (context) lines.push(context);
  if (recallFilePath) lines.push(`Supermemory recall file for this session: ${recallFilePath}`);
  if (!lines.length) return hookOk();

  process.stdout.write(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: "sessionStart",
      additionalContext: lines.join("\n\n"),
    },
  }));
}

runHookSafe("session-start", main);
