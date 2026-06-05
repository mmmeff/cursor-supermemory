import { createClient } from "./client.ts";
import type { Config } from "./config.ts";
import { memoryBody, type MemoryDocument } from "./memoryText.ts";

const MAX_RECALL_LENGTH = 1500;

/**
 * Query-scoped semantic recall against a container. Returns a formatted context
 * block (or "" when nothing relevant). Used to seed per-turn recall from the
 * user's actual prompt — the closest supported analogue to Hermes' prefetch().
 */
export async function searchRecall(
  apiKey: string,
  containerTag: string,
  query: string,
  config: Pick<Config, "maxMemories" | "similarityThreshold">,
): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "";

  try {
    const res = await createClient(apiKey, containerTag).search.memories({
      q: trimmed.slice(0, 500),
      containerTag,
      limit: config.maxMemories,
    });
    const hits = (res.results ?? []) as MemoryDocument[];
    const lines = hits
      .filter((h) => (h.similarity ?? 1) >= config.similarityThreshold)
      .map((h) => memoryBody(h))
      .filter((t) => t.length > 0)
      .map((t) => `- ${t}`);
    if (!lines.length) return "";

    let block =
      "[SUPERMEMORY RECALL] Potentially relevant past learnings for this request " +
      "(use silently when helpful; ignore if irrelevant):\n" +
      lines.join("\n");
    if (block.length > MAX_RECALL_LENGTH) block = block.slice(0, MAX_RECALL_LENGTH - 3) + "...";
    return block;
  } catch {
    return "";
  }
}
