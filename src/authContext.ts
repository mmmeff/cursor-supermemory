import { loadConfig, getApiKey, type Config } from "./config.ts";
import { getUserTag, getProjectTag } from "./tags.ts";

export interface AuthContext {
  apiKey: string;
  config: Config;
  userTag: string;
  projectTag: string;
  workspaceRoot: string;
}

export function applyUserEmail(userEmail?: string): void {
  if (userEmail && !process.env.CURSOR_USER_EMAIL) {
    process.env.CURSOR_USER_EMAIL = userEmail;
  }
}

export function resolveAuth(workspaceRoot: string = process.cwd()): AuthContext | null {
  const config = loadConfig(workspaceRoot);
  const apiKey = getApiKey(config);
  if (!apiKey) return null;

  return {
    apiKey,
    config,
    userTag: getUserTag(config),
    projectTag: getProjectTag(workspaceRoot, config),
    workspaceRoot,
  };
}

export function resolveContainerTag(auth: AuthContext, container?: string): string {
  if (!container || container === "user") return auth.userTag;
  if (container === "project") return auth.projectTag;
  return container;
}
