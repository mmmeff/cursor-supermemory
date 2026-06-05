import { searchRecallForQueries } from "../recall.ts";
import { deriveMidTurnRecallQueries } from "../recallQueries.ts";
import { getRecallFilePath, withRecallFileHeader, writeRecallFile } from "../recallFile.ts";
import {
  buildTrajectoryContext,
  formatTopicalRecallBlock,
  markMidTurnRefresh,
  pushRecentTool,
  shouldRefreshMidTurnRecall,
  summarizeToolUse,
  syncGenerationSession,
} from "../midTurnRecall.ts";
import { claimPendingRecall, loadSession, saveSession } from "../sessionStore.ts";
import {
  hookOk,
  hookPostToolAdditionalContext,
  readHookInput,
  resolveHookAuth,
  runHookSafe,
} from "../hookRuntime.ts";

interface PostToolUseInput {
  conversation_id?: string;
  generation_id?: string;
  workspace_roots?: string[];
  user_email?: string;
  tool_name?: string;
  tool_input?: unknown;
  tool_output?: string;
}

async function main() {
  const input = await readHookInput<PostToolUseInput>();

  const conversationId = input.conversation_id ?? "";
  if (!conversationId) return hookOk();

  const auth = resolveHookAuth(input);
  if (!auth) return hookOk();

  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  const session = loadSession(conversationId);
  const generationId = input.generation_id ?? "";
  if (generationId) syncGenerationSession(session, generationId);

  session.toolCountThisGeneration += 1;
  pushRecentTool(
    session,
    summarizeToolUse(input.tool_name ?? "Tool", input.tool_input, input.tool_output),
    auth.config.midTurnRecallRecentTools,
  );

  const contextParts: string[] = [];
  const recallFilePath = getRecallFilePath(auth.projectTag, conversationId);
  const pendingTurnStart = claimPendingRecall(conversationId);
  if (pendingTurnStart) contextParts.push(withRecallFileHeader(recallFilePath, pendingTurnStart));

  if (shouldRefreshMidTurnRecall(session, auth.config)) {
    const trajectory = buildTrajectoryContext(session, auth.config.midTurnRecallRecentTools);
    const derivedQueries = await deriveMidTurnRecallQueries(trajectory);
    const recall = await searchRecallForQueries(
      auth.apiKey,
      auth.projectTag,
      [session.userPromptThisGeneration, ...derivedQueries],
      auth.config,
    );

    if (recall) {
      writeRecallFile(auth.projectTag, conversationId, recall, workspaceRoot);
      markMidTurnRefresh(session);
      contextParts.push(withRecallFileHeader(recallFilePath, formatTopicalRecallBlock(recall)));
    }
  }

  saveSession(session);

  if (contextParts.length) {
    hookPostToolAdditionalContext(contextParts.join("\n\n"));
    return;
  }

  return hookOk();
}

runHookSafe("post-tool-use", main);
