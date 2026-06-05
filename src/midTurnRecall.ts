import type { Config } from "./config.ts";
import type { SessionState } from "./sessionStore.ts";

export function resetMidTurnStateForNewPrompt(session: SessionState, userPrompt: string): void {
  session.userPromptThisGeneration = userPrompt.trim();
  session.generationId = null;
  session.toolCountThisGeneration = 0;
  session.midTurnRefreshCountThisGeneration = 0;
  session.lastMidTurnRefreshMs = 0;
  session.recentTools = [];
  session.thoughtSnippet = null;
}

export function syncGenerationSession(session: SessionState, generationId: string): void {
  if (!generationId || session.generationId === generationId) return;

  session.generationId = generationId;
  session.toolCountThisGeneration = 0;
  session.midTurnRefreshCountThisGeneration = 0;
  session.lastMidTurnRefreshMs = 0;
  session.recentTools = [];
  session.thoughtSnippet = null;
}

export function pushRecentTool(session: SessionState, summary: string, maxTools: number): void {
  if (!summary.trim()) return;
  session.recentTools.push(summary.trim());
  if (session.recentTools.length > maxTools) {
    session.recentTools = session.recentTools.slice(-maxTools);
  }
}

export function shouldRefreshMidTurnRecall(
  session: SessionState,
  config: Pick<
    Config,
    | "midTurnRecallEnabled"
    | "midTurnRecallEveryNTools"
    | "midTurnRecallMinIntervalMs"
    | "midTurnRecallMaxPerTurn"
  >,
  now = Date.now(),
): boolean {
  if (!config.midTurnRecallEnabled) return false;
  if (!session.userPromptThisGeneration.trim()) return false;
  if (session.midTurnRefreshCountThisGeneration >= config.midTurnRecallMaxPerTurn) return false;
  if (session.toolCountThisGeneration < config.midTurnRecallEveryNTools) return false;
  if (session.toolCountThisGeneration % config.midTurnRecallEveryNTools !== 0) return false;
  if (
    session.lastMidTurnRefreshMs > 0 &&
    now - session.lastMidTurnRefreshMs < config.midTurnRecallMinIntervalMs
  ) {
    return false;
  }
  return true;
}

export function buildTrajectoryContext(
  session: SessionState,
  maxRecentTools: number,
): string {
  const lines = [
    "User message:",
    session.userPromptThisGeneration.trim().slice(0, 2000),
  ];

  if (session.thoughtSnippet) {
    lines.push("", "Recent agent reasoning:", session.thoughtSnippet.slice(0, 1500));
  }

  const tools = session.recentTools.slice(-maxRecentTools);
  if (tools.length) {
    lines.push("", "Recent tool activity:");
    for (const tool of tools) lines.push(`- ${tool}`);
  }

  return lines.join("\n");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

function summarizeToolInput(toolName: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";

  const obj = input as Record<string, unknown>;
  if (typeof obj.path === "string") return obj.path;
  if (typeof obj.target_directory === "string" && typeof obj.pattern === "string") {
    return `${obj.pattern} in ${obj.target_directory}`;
  }
  if (typeof obj.pattern === "string") return `pattern="${obj.pattern}"`;
  if (typeof obj.command === "string") return truncate(obj.command, 120);
  if (typeof obj.query === "string") return truncate(obj.query, 120);
  if (typeof obj.description === "string") return truncate(obj.description, 120);
  if (typeof obj.task === "string") return truncate(obj.task, 120);

  return truncate(JSON.stringify(input), 120);
}

function summarizeToolOutput(toolOutput: string | undefined): string {
  if (!toolOutput) return "";
  const trimmed = toolOutput.trim();
  if (!trimmed) return "";

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.stdout === "string" && parsed.stdout.trim()) {
      return truncate(parsed.stdout.trim(), 150);
    }
    if (typeof parsed.content === "string") return truncate(parsed.content, 150);
    return truncate(JSON.stringify(parsed), 150);
  } catch {
    return truncate(trimmed, 150);
  }
}

export function summarizeToolUse(
  toolName: string,
  toolInput: unknown,
  toolOutput: string | undefined,
): string {
  const inputSummary = summarizeToolInput(toolName, toolInput);
  const outputSummary = summarizeToolOutput(toolOutput);
  const base = inputSummary ? `${toolName}(${inputSummary})` : toolName;
  return outputSummary ? `${base} -> ${outputSummary}` : base;
}

export function formatTopicalRecallBlock(recall: string): string {
  if (!recall.includes("[SUPERMEMORY RECALL]")) return recall;
  return recall.replace(
    "[SUPERMEMORY RECALL] Potentially relevant past learnings for this request",
    "[SUPERMEMORY TOPICAL REFRESH] Updated past learnings for the current line of investigation",
  );
}

export function markMidTurnRefresh(session: SessionState, now = Date.now()): void {
  session.midTurnRefreshCountThisGeneration += 1;
  session.lastMidTurnRefreshMs = now;
  session.thoughtSnippet = null;
}
