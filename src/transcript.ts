import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export interface Turn {
  role: string;
  content?: unknown;
  message?: unknown;
}

export interface Exchange {
  role: string;
  text: string;
}

// Cursor transcripts store each turn as { role, message: { content: [{ type, text }] } }.
// Older/other formats may use a flat string `content`. Extract plain text from either.
export function extractTurnText(turn: Turn): string {
  if (typeof turn.content === "string") return turn.content;

  const message = turn.message as { content?: unknown } | undefined;
  const blocks = message?.content;
  if (Array.isArray(blocks)) {
    return blocks
      .filter(
        (b): b is { type: string; text: string } =>
          !!b && typeof b === "object" && (b as { type?: unknown }).type === "text" &&
          typeof (b as { text?: unknown }).text === "string",
      )
      .map((b) => b.text)
      .join("\n");
  }
  return "";
}

export function parseTranscript(text: string): Turn[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter((t): t is Turn => t !== null);
}

// Read a transcript file and return the user/assistant exchanges with text.
export async function readExchanges(transcriptPath: string): Promise<Exchange[]> {
  if (!existsSync(transcriptPath)) return [];
  const turns = parseTranscript(await readFile(transcriptPath, "utf-8"));
  return turns
    .filter((t) => t.role === "user" || t.role === "assistant")
    .map((t) => ({ role: t.role, text: extractTurnText(t) }))
    .filter((t) => t.text.length > 0);
}

// Pair the most recent assistant reply with the user message that prompted it.
// Anchors on the last ASSISTANT turn (stop fires after the agent responds), so a
// trailing dangling user message doesn't suppress capture.
export function latestExchange(exchanges: Exchange[]): { user: string; assistant: string } | null {
  let lastAssistantIdx = -1;
  for (let i = exchanges.length - 1; i >= 0; i--) {
    if (exchanges[i].role === "assistant") {
      lastAssistantIdx = i;
      break;
    }
  }
  if (lastAssistantIdx === -1) return null;

  // Find the user message immediately preceding this assistant block.
  let userIdx = -1;
  for (let i = lastAssistantIdx - 1; i >= 0; i--) {
    if (exchanges[i].role === "user") {
      userIdx = i;
      break;
    }
  }

  const assistant = exchanges
    .slice(lastAssistantIdx)
    .filter((e) => e.role === "assistant")
    .map((e) => e.text)
    .join("\n");
  const user = userIdx === -1 ? "" : exchanges[userIdx].text;
  if (!assistant) return null;
  return { user, assistant };
}
