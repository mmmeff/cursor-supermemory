import { memoryBody, type MemoryDocument } from "./memoryText.ts";

const MAX_LENGTH = 2000;

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = diff / 60_000;
  const hours = diff / 3_600_000;
  const days = diff / 86_400_000;
  const weeks = diff / 604_800_000;

  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return `${Math.floor(weeks)}w ago`;
}

export interface ProfileSummary {
  static?: string[];
  dynamic?: string[];
}

export function coerceProfile(value: unknown): ProfileSummary | null {
  if (!value || typeof value !== "object") return null;

  const profile: ProfileSummary = {};
  if ("static" in value && Array.isArray(value.static)) {
    profile.static = value.static.filter((item): item is string => typeof item === "string");
  }
  if ("dynamic" in value && Array.isArray(value.dynamic)) {
    profile.dynamic = value.dynamic.filter((item): item is string => typeof item === "string");
  }

  if (!profile.static?.length && !profile.dynamic?.length) return null;
  return profile;
}

export function formatContext(profile: ProfileSummary | null, memories: MemoryDocument[]): string {
  const profileItems: string[] = profile?.static ?? profile?.dynamic ?? [];
  const hasProfile = profileItems.length > 0;
  const hasMemories = memories.length > 0;

  if (!hasProfile && !hasMemories) return "";

  const sections: string[] = ["[SUPERMEMORY CONTEXT]"];

  if (hasProfile) {
    sections.push(
      "\nUser Profile:",
      ...profileItems.map((item) => `- ${item}`),
    );
  }

  if (hasMemories) {
    sections.push(
      "\nProject Knowledge:",
      ...memories.map((m) => {
        const time = m.updatedAt ? `[${formatRelativeTime(m.updatedAt)}] ` : "";
        const body = memoryBody(m);
        const label = m.title ? `${m.title}: ` : "";
        return `- ${time}${label}${body}`;
      }),
    );
  }

  sections.push("\nUse these memories when relevant. Don't force them into every response.");

  let result = sections.join("\n");
  if (result.length > MAX_LENGTH) {
    result = result.slice(0, MAX_LENGTH - 3) + "...";
  }
  return result;
}
