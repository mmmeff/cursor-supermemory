import { loadCredentials } from "../auth.ts";
import { loadConfig, getApiKey } from "../config.ts";
import { getUserTag, getProjectTag } from "../tags.ts";
import { createClient } from "../client.ts";

interface SessionEndInput {
  session_id: string;
  transcript_path?: string;
  reason?: string;
}

interface Turn {
  role: string;
  content: unknown;
}

function parseTranscript(text: string): Turn[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}

  // Try JSONL
  return text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

async function main() {
  const raw = await Bun.stdin.text();
  const input: SessionEndInput = JSON.parse(raw);

  if (!input.transcript_path || input.reason !== "completed") return;

  const creds = loadCredentials();
  if (!creds) return;

  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) return;

  const fileContent = await Bun.file(input.transcript_path).text();
  const turns = parseTranscript(fileContent);

  const relevant = turns.filter(
    (t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string",
  );
  const userTurns = relevant.filter((t) => t.role === "user");
  if (userTurns.length < 2) return;

  let transcript = relevant
    .map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`)
    .join("\n");
  if (transcript.length > 100_000) {
    transcript = transcript.slice(0, 100_000);
  }

  const userTag = getUserTag(config);
  const projectTag = getProjectTag(process.cwd(), config);
  const content = `Cursor IDE session transcript:\n${transcript}`;

  await Promise.allSettled([
    createClient(apiKey, userTag).add({ content, containerTag: userTag }),
    createClient(apiKey, projectTag).add({ content, containerTag: projectTag }),
  ]);
}

main().catch((err) => {
  console.error("[supermemory] session-end error:", err);
});
