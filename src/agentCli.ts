import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { whichOnPath } from "./which.ts";

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

  return whichOnPath("agent");
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

  const args = [
    "-p",
    prompt,
    "--model",
    model,
    "--output-format",
    "json",
    "--mode",
    "ask",
    "--trust",
  ];

  try {
    const proc = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    const timeout = setTimeout(() => proc.kill(), CLI_TIMEOUT_MS);

    const { stdout, exitCode } = await new Promise<{ stdout: string; exitCode: number | null }>(
      (resolve) => {
        const chunks: Buffer[] = [];
        proc.stdout?.on("data", (chunk) => chunks.push(chunk));
        proc.on("error", () => resolve({ stdout: "", exitCode: 1 }));
        proc.on("close", (code) =>
          resolve({ stdout: Buffer.concat(chunks).toString("utf-8"), exitCode: code }),
        );
      },
    );
    clearTimeout(timeout);

    if (exitCode !== 0) return null;

    const envelope = JSON.parse(stdout) as AgentResultEnvelope;
    if (envelope.is_error || typeof envelope.result !== "string") return null;
    return envelope.result.trim();
  } catch {
    return null;
  }
}
