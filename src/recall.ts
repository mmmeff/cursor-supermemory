import { createClient } from "./client.ts";

const RECALL_LIMIT = 5;
const MAX_RECALL_LENGTH = 1500;

interface SearchHit {
  memory?: string;
  content?: string;
  summary?: string;
}

/**
 * Query-scoped semantic recall against a container. Returns a formatted context
 * block (or "" when nothing relevant). Used to seed per-turn recall from the
 * user's actual prompt — the closest supported analogue to Hermes' prefetch().
 */
export async function searchRecall(
  apiKey: string,
  containerTag: string,
  query: string,
): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "";

  try {
    const res = await createClient(apiKey, containerTag).search.memories({
      q: trimmed.slice(0, 500),
      containerTag,
      limit: RECALL_LIMIT,
    });
    const hits = (res.results ?? []) as SearchHit[];
    const lines = hits
      .map((h) => (h.memory ?? h.content ?? h.summary ?? "").trim())
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
