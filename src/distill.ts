import { runAgentCompletion, DEFAULT_DISTILL_MODEL } from "./agentCli.ts";

export interface DistilledNotes {
  projectNotes: string[];
  userNotes: string[];
}

export interface DistillOptions {
  model?: string;
  // Approximate max characters of transcript to put in a single window. Sized
  // well under composer-2.5's context so the prompt + instructions also fit.
  windowChars?: number;
  // Characters of overlap between adjacent windows so insights spanning a
  // boundary aren't lost.
  overlapChars?: number;
}

const DEFAULTS = {
  model: DEFAULT_DISTILL_MODEL,
  // ~4 chars/token. 48k tokens of transcript ≈ 190k chars, comfortably inside
  // composer-2.5 while leaving room for the instruction prompt and output.
  windowChars: 190_000,
  overlapChars: 8_000,
} satisfies Required<DistillOptions>;

const PROJECT_HEADER = "PROJECT:";
const USER_HEADER = "USER:";
const NONE = "NONE";

function buildExtractionPrompt(transcript: string, isChunk: boolean, part?: { index: number; total: number }): string {
  const scope = isChunk
    ? `This is part ${part!.index} of ${part!.total} of a longer transcript.`
    : "This is a complete transcript.";
  return [
    "You are distilling durable, reusable learnings from a Cursor IDE coding session transcript.",
    "Do NOT use any tools, do NOT read any files, do NOT take any actions. Only read the transcript text below and respond.",
    "",
    "Extract two kinds of learnings, each as short, self-contained bullet points (one insight per bullet):",
    "",
    `${PROJECT_HEADER} codebase-specific facts worth remembering for future work in THIS project — architecture decisions, conventions, gotchas, where things live, build/test commands, non-obvious technical insights, bug root-causes and their fixes.`,
    `${USER_HEADER} durable facts about the DEVELOPER that generalize across projects — their preferences, workflows, tools, coding style, and explicit "remember this" requests.`,
    "",
    "Rules:",
    "- Capture genuinely useful, lasting insights. Skip transient chatter, one-off task status, restated questions, and obvious/self-evident facts.",
    "- Be concise and specific. Prefer concrete names (files, commands, symbols) over vague description.",
    "- When in doubt, store less.",
    "",
    "Output format — exactly these two sections, nothing else:",
    `${PROJECT_HEADER}`,
    "- <project learning>",
    `${USER_HEADER}`,
    "- <user learning>",
    "",
    `If a section has no durable learnings, write "${NONE}" on the line under its header.`,
    "",
    scope,
    "--- TRANSCRIPT START ---",
    transcript,
    "--- TRANSCRIPT END ---",
  ].join("\n");
}

function buildMergePrompt(notes: DistilledNotes): string {
  return [
    "You are consolidating learnings extracted from overlapping windows of one coding session.",
    "Do NOT use any tools or read any files. Only process the lists below.",
    "",
    "Merge duplicates and near-duplicates, keep each insight once, and drop anything trivial.",
    "",
    "Output exactly two sections, nothing else:",
    `${PROJECT_HEADER}`,
    "- <project learning>",
    `${USER_HEADER}`,
    "- <user learning>",
    `If a section is empty, write "${NONE}" under its header.`,
    "",
    `${PROJECT_HEADER}`,
    notes.projectNotes.map((n) => `- ${n}`).join("\n") || NONE,
    `${USER_HEADER}`,
    notes.userNotes.map((n) => `- ${n}`).join("\n") || NONE,
  ].join("\n");
}

// Split a long transcript into overlapping windows on line boundaries.
function chunkTranscript(transcript: string, windowChars: number, overlapChars: number): string[] {
  if (transcript.length <= windowChars) return [transcript];

  const chunks: string[] = [];
  const step = Math.max(1, windowChars - overlapChars);
  for (let start = 0; start < transcript.length; start += step) {
    const end = Math.min(start + windowChars, transcript.length);
    chunks.push(transcript.slice(start, end));
    if (end === transcript.length) break;
  }
  return chunks;
}

function parseSections(text: string): { projectNotes: string[]; userNotes: string[] } {
  const projectNotes: string[] = [];
  const userNotes: string[] = [];
  let current: "project" | "user" | null = null;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.toUpperCase().startsWith(PROJECT_HEADER)) {
      current = "project";
      continue;
    }
    if (line.toUpperCase().startsWith(USER_HEADER)) {
      current = "user";
      continue;
    }
    if (line.toUpperCase() === NONE) continue;

    const bullet = line.replace(/^[-*•]\s*/, "").trim();
    if (!bullet) continue;
    if (current === "project") projectNotes.push(bullet);
    else if (current === "user") userNotes.push(bullet);
  }
  return { projectNotes, userNotes };
}

function dedupe(notes: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of notes) {
    const key = note.toLowerCase().replace(/\s+/g, " ").trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(note);
    }
  }
  return out;
}

/**
 * Distill a session transcript into condensed project- and user-scoped notes
 * using the local Cursor Agent CLI. Long transcripts are scanned with
 * overlapping windows and the per-window results merged.
 *
 * Returns null if inference is unavailable (CLI missing / not authenticated) or
 * produced nothing usable — callers should skip persistence in that case.
 */
export async function distillTranscript(
  transcript: string,
  options: DistillOptions = {},
): Promise<DistilledNotes | null> {
  const { model, windowChars, overlapChars } = { ...DEFAULTS, ...options };
  const chunks = chunkTranscript(transcript, windowChars, overlapChars);

  const collected: DistilledNotes = { projectNotes: [], userNotes: [] };
  let anyResponse = false;

  for (let i = 0; i < chunks.length; i++) {
    const prompt = buildExtractionPrompt(
      chunks[i],
      chunks.length > 1,
      { index: i + 1, total: chunks.length },
    );
    const raw = await runAgentCompletion(prompt, model);
    if (raw === null) {
      // CLI unavailable: bail entirely so we don't persist a partial result.
      if (i === 0) return null;
      continue;
    }
    anyResponse = true;
    const parsed = parseSections(raw);
    collected.projectNotes.push(...parsed.projectNotes);
    collected.userNotes.push(...parsed.userNotes);
  }

  if (!anyResponse) return null;

  collected.projectNotes = dedupe(collected.projectNotes);
  collected.userNotes = dedupe(collected.userNotes);

  // With multiple windows, overlap produces duplicate/fragmented notes — run a
  // final consolidation pass to merge them into a clean set.
  if (chunks.length > 1 && (collected.projectNotes.length || collected.userNotes.length)) {
    const merged = await runAgentCompletion(buildMergePrompt(collected), model);
    if (merged !== null) {
      const reparsed = parseSections(merged);
      if (reparsed.projectNotes.length || reparsed.userNotes.length) {
        return {
          projectNotes: dedupe(reparsed.projectNotes),
          userNotes: dedupe(reparsed.userNotes),
        };
      }
    }
  }

  if (!collected.projectNotes.length && !collected.userNotes.length) return null;
  return collected;
}

// Render a note list into a single document for storage in a container.
export function formatNotesForStorage(notes: string[], scope: "project" | "user"): string {
  const heading = scope === "project" ? "Project learnings" : "User learnings";
  return `${heading} (distilled from a Cursor session):\n${notes.map((n) => `- ${n}`).join("\n")}`;
}
