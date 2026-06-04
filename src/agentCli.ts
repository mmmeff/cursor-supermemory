import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

// Default cheap/fast model for distillation. composer-2.5 is confirmed available
// via `agent --list-models` and is the intended low-cost summarization model.
export const DEFAULT_DISTILL_MODEL = "composer-2.5";

const CLI_TIMEOUT_MS = 120_000;

interface AgentResultEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
}

// Cursor installs the agent CLI to ~/.local/bin/agent. Hooks may run with a
// minimal PATH, so resolve the absolute path first and fall back to PATH lookup.
function resolveAgentBinary(): string | null {
  const localBin = join(homedir(), ".local", "bin", "agent");
  if (existsSync(localBin)) return localBin;

  const onPath = Bun.which("agent");
  return onPath ?? null;
}

export function isAgentCliAvailable(): boolean {
  return resolveAgentBinary() !== null;
}

/**
 * Run a one-shot, read-only completion through the locally-installed Cursor
 * Agent CLI. Uses the user's existing Cursor login (no API key/config needed).
 *
 * Returns the assistant's final text, or null on any failure (CLI missing,
 * not authenticated, non-zero exit, error envelope). Callers should treat null
 * as "inference unavailable" and degrade gracefully.
 */
export async function runAgentCompletion(
  prompt: string,
  model: string = DEFAULT_DISTILL_MODEL,
): Promise<string | null> {
  const binary = resolveAgentBinary();
  if (!binary) return null;

  try {
    const proc = Bun.spawn(
      [
        binary,
        "-p",
        prompt,
        "--model",
        model,
        "--output-format",
        "json",
        // ask mode = read-only Q&A; --trust avoids the interactive workspace
        // trust prompt in headless mode. No tools, no edits.
        "--mode",
        "ask",
        "--trust",
      ],
      { stdout: "pipe", stderr: "pipe", stdin: "ignore" },
    );

    const timeout = setTimeout(() => proc.kill(), CLI_TIMEOUT_MS);
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    clearTimeout(timeout);

    if (exitCode !== 0) return null;

    const envelope = JSON.parse(stdout) as AgentResultEnvelope;
    if (envelope.is_error || typeof envelope.result !== "string") return null;
    return envelope.result.trim();
  } catch {
    return null;
  }
}
