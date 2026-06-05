import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { whichOnPath } from "./which.ts";

export const DEFAULT_DISTILL_MODEL = "composer-2.5";

const CLI_TIMEOUT_MS = 120_000;

interface AgentResultEnvelope {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
}

interface AgentStatusJson {
  isAuthenticated?: boolean;
  userInfo?: { email?: string };
}

interface RunCommandOptions {
  inheritStdio?: boolean;
  timeoutMs?: number;
}

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
  options: RunCommandOptions = {},
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

export async function runAgentCompletion(
  prompt: string,
  model: string = DEFAULT_DISTILL_MODEL,
  timeoutMs: number = CLI_TIMEOUT_MS,
): Promise<string | null> {
  const binary = resolveAgentBinary();
  if (!binary) return null;

  const { stdout, exitCode } = await runCommand(
    binary,
    ["-p", prompt, "--model", model, "--output-format", "json", "--mode", "ask", "--trust"],
    { timeoutMs },
  );

  if (exitCode !== 0) return null;

  try {
    const envelope = JSON.parse(stdout) as AgentResultEnvelope;
    if (envelope.is_error || typeof envelope.result !== "string") return null;
    return envelope.result.trim();
  } catch {
    return null;
  }
}
