import { DEFAULT_DISTILL_MODEL, isAgentCliAvailable, runAgentCompletion } from "./agentCli.ts";

export const RECALL_QUERY_TIMEOUT_MS = 25_000;
export const DERIVED_RECALL_QUERY_COUNT = 2;

export function buildRecallQueryPrompt(userPrompt: string): string {
  const trimmed = userPrompt.trim().slice(0, 4000);
  return [
    "You help a coding assistant retrieve relevant project memories before it starts working.",
    "Do NOT use any tools, do NOT read any files, do NOT take any actions. Only read the user message below.",
    "",
    `Given the user's message, write exactly ${DERIVED_RECALL_QUERY_COUNT} short semantic search queries that would surface useful project memories the assistant needs early.`,
    "Focus on related architecture, past bugs, conventions, dependencies, domain context, or non-obvious prerequisites.",
    "",
    "Rules:",
    "- Each query should be 5-15 words and specific to this request",
    "- Do not repeat or lightly rephrase the user's message verbatim",
    "- Do not ask meta questions about the user or the assistant",
    "",
    'Output ONLY valid JSON with no markdown fences: {"queries":["first query","second query"]}',
    "",
    "User message:",
    trimmed,
  ].join("\n");
}

export function parseDerivedRecallQueries(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  const jsonText = trimmed.startsWith("{")
    ? trimmed
    : trimmed.match(/\{[\s\S]*\}/)?.[0] ?? "";
  if (!jsonText) return [];

  try {
    const parsed = JSON.parse(jsonText) as { queries?: unknown };
    if (!Array.isArray(parsed.queries)) return [];

    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of parsed.queries) {
      if (typeof item !== "string") continue;
      const query = item.trim();
      if (!query) continue;
      const key = query.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(query);
      if (out.length >= DERIVED_RECALL_QUERY_COUNT) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function buildMidTurnRecallQueryPrompt(trajectoryContext: string): string {
  const trimmed = trajectoryContext.trim().slice(0, 5000);
  return [
    "You help a coding assistant retrieve relevant project memories mid-task.",
    "The assistant may have shifted focus since the user's original message.",
    "Do NOT use any tools, do NOT read any files, do NOT take any actions. Only read the context below.",
    "",
    `Given the current trajectory, write exactly ${DERIVED_RECALL_QUERY_COUNT} short semantic search queries for memories that would help with where the work is heading now.`,
    "Focus on the emerging topic, related architecture, past bugs, conventions, dependencies, or prerequisites implied by recent tool activity.",
    "",
    "Rules:",
    "- Each query should be 5-15 words and specific to the current investigation",
    "- Prefer the current trajectory over repeating the original user message verbatim",
    "- Do not ask meta questions about the user or the assistant",
    "",
    'Output ONLY valid JSON with no markdown fences: {"queries":["first query","second query"]}',
    "",
    "Current trajectory:",
    trimmed,
  ].join("\n");
}

export async function deriveMidTurnRecallQueries(trajectoryContext: string): Promise<string[]> {
  const trimmed = trajectoryContext.trim();
  if (!trimmed || !isAgentCliAvailable()) return [];

  const result = await runAgentCompletion(
    buildMidTurnRecallQueryPrompt(trimmed),
    DEFAULT_DISTILL_MODEL,
    RECALL_QUERY_TIMEOUT_MS,
  );
  if (!result) return [];

  return parseDerivedRecallQueries(result);
}

export async function deriveRecallQueries(userPrompt: string): Promise<string[]> {
  const trimmed = userPrompt.trim();
  if (!trimmed || !isAgentCliAvailable()) return [];

  const result = await runAgentCompletion(
    buildRecallQueryPrompt(trimmed),
    DEFAULT_DISTILL_MODEL,
    RECALL_QUERY_TIMEOUT_MS,
  );
  if (!result) return [];

  return parseDerivedRecallQueries(result);
}
