export interface MemoryDocument {
  memory?: string;
  content?: string;
  summary?: string;
  chunk?: string;
  title?: string;
  updatedAt?: string;
  similarity?: number;
}

export function memoryBody(doc: MemoryDocument): string {
  return (doc.memory ?? doc.content ?? doc.summary ?? doc.chunk ?? "").trim();
}

export function coerceMemoryDocuments(items: unknown): MemoryDocument[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item): item is MemoryDocument => typeof item === "object" && item !== null);
}
