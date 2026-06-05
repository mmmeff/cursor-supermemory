import { createClient } from "./client.ts";
import type { Config } from "./config.ts";
import { memoryBody, type MemoryDocument } from "./memoryText.ts";

const MAX_RECALL_LENGTH = 1500;

export function mergeMemoryHits(hits: MemoryDocument[]): MemoryDocument[] {
  const byBody = new Map<string, MemoryDocument>();

  for (const hit of hits) {
    const body = memoryBody(hit);
    if (!body) continue;
    const key = body.toLowerCase();
    const existing = byBody.get(key);
    if (!existing || (hit.similarity ?? 0) > (existing.similarity ?? 0)) {
      byBody.set(key, hit);
    }
  }

  return [...byBody.values()].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
}

function formatRecallBlock(lines: string[]): string {
  let block =
    "[SUPERMEMORY RECALL] Potentially relevant past learnings for this request " +
    "(use silently when helpful; ignore if irrelevant):\n" +
    lines.join("\n");
  if (block.length > MAX_RECALL_LENGTH) block = block.slice(0, MAX_RECALL_LENGTH - 3) + "...";
  return block;
}

/**
 * Semantic recall against a container using one or more queries. Results are
 * merged, deduped by memory body, and capped at config.maxMemories.
 */
export async function searchRecallForQueries(
  apiKey: string,
  containerTag: string,
  queries: string[],
  config: Pick<Config, "maxMemories" | "similarityThreshold">,
): Promise<string> {
  const uniqueQueries = [...new Set(queries.map((q) => q.trim()).filter(Boolean))];
  if (!uniqueQueries.length) return "";

  const client = createClient(apiKey, containerTag);
  const resultSets = await Promise.all(
    uniqueQueries.map(async (query) => {
      try {
        const res = await client.search.memories({
          q: query.slice(0, 500),
          containerTag,
          limit: config.maxMemories,
        });
        return (res.results ?? []) as MemoryDocument[];
      } catch {
        return [];
      }
    }),
  );

  const hits = mergeMemoryHits(resultSets.flat())
    .filter((hit) => (hit.similarity ?? 1) >= config.similarityThreshold)
    .slice(0, config.maxMemories);

  const lines = hits
    .map((hit) => memoryBody(hit))
    .filter((text) => text.length > 0)
    .map((text) => `- ${text}`);

  if (!lines.length) return "";
  return formatRecallBlock(lines);
}

/** Single-query recall; prefer searchRecallForQueries when multiple queries are available. */
export async function searchRecall(
  apiKey: string,
  containerTag: string,
  query: string,
  config: Pick<Config, "maxMemories" | "similarityThreshold">,
): Promise<string> {
  return searchRecallForQueries(apiKey, containerTag, [query], config);
}
