import crypto from "node:crypto";
import os from "node:os";
import { execSync } from "node:child_process";
import type { Config } from "./config.ts";

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

function getGitEmail(): string | null {
  try {
    return execSync("git config user.email", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function getGitRoot(dir: string): string | null {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd: dir,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim() || null;
  } catch {
    return null;
  }
}

function getMachineId(): string {
  return `${os.hostname()}_${os.userInfo().username}`;
}

export function getUserTag(config: Config): string {
  const identity =
    config.userContainerTag ??
    process.env.SUPERMEMORY_USER_TAG ??
    process.env.CURSOR_USER_EMAIL ??
    getGitEmail() ??
    getMachineId();

  return `cursor_user_${sha256(identity)}`;
}

export function getProjectTag(workspaceRoot: string, config: Config): string {
  const identity =
    config.projectContainerTag ??
    process.env.SUPERMEMORY_PROJECT_TAG ??
    (getGitRoot(workspaceRoot) || workspaceRoot);

  return `cursor_project_${sha256(identity)}`;
}
