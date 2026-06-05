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

export interface AgentCliStatus {
  available: boolean;
  authenticated: boolean;
  binary: string | null;
  email?: string;
  error?: string;
}

interface AgentStatusJson {
  isAuthenticated?: boolean;
  userInfo?: { email?: string };
}

export function parseAgentStatusJson(stdout: string): { authenticated: boolean; email?: string } | null {
  try {
    const data = JSON.parse(stdout.trim()) as AgentStatusJson;
    return {
      authenticated: data.isAuthenticated === true,
      email: data.userInfo?.email,
    };
  } catch {
    return null;
  }
}

async function runCommand(
  binary: string,
  args: string[],
  options: { inheritStdio?: boolean; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const { inheritStdio = false, timeoutMs } = options;

  return new Promise((resolve) => {
    const proc = spawn(binary, args, {
      stdio: inheritStdio ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    const timeout = timeoutMs ? setTimeout(() => proc.kill(), timeoutMs) : null;
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout?.on("data", (chunk) => stdoutChunks.push(chunk));
    proc.stderr?.on("data", (chunk) => stderrChunks.push(chunk));
    proc.on("error", () => {
      if (timeout) clearTimeout(timeout);
      resolve({ stdout: "", stderr: "", exitCode: 1 });
    });
    proc.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
        exitCode: code,
      });
    });
  });
}

export async function getAgentCliStatus(): Promise<AgentCliStatus> {
  const binary = resolveAgentBinary();
  if (!binary) {
    return {
      available: false,
      authenticated: false,
      binary: null,
      error: "Cursor Agent CLI not found",
    };
  }

  const { stdout, exitCode } = await runCommand(binary, ["status", "--format", "json"]);
  if (exitCode !== 0) {
    return {
      available: true,
      authenticated: false,
      binary,
      error: "agent status failed",
    };
  }

  const parsed = parseAgentStatusJson(stdout);
  if (!parsed) {
    return {
      available: true,
      authenticated: false,
      binary,
      error: "Could not parse agent status",
    };
  }

  return {
    available: true,
    authenticated: parsed.authenticated,
    binary,
    email: parsed.email,
  };
}

export async function runAgentLogin(): Promise<boolean> {
  const binary = resolveAgentBinary();
  if (!binary) return false;

  const { exitCode } = await runCommand(binary, ["login"], { inheritStdio: true });
  return exitCode === 0;
}

export async function installAgentCli(): Promise<boolean> {
  const installScript =
    process.platform === "win32"
      ? "irm 'https://cursor.com/install?win32=true' | iex"
      : "curl https://cursor.com/install -fsS | bash";
  const shell = process.platform === "win32" ? "powershell.exe" : "bash";
  const shellArgs = process.platform === "win32" ? ["-Command", installScript] : ["-c", installScript];

  const { exitCode } = await runCommand(shell, shellArgs, { inheritStdio: true });
  return exitCode === 0;
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
