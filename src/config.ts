import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { loadCredentials } from "./auth.ts";

export interface Config {
  apiKey: string | null;
  similarityThreshold: number;
  maxMemories: number;
  maxProjectMemories: number;
  injectProfile: boolean;
  userContainerTag: string | null;
  projectContainerTag: string | null;
}

const DEFAULTS: Omit<Config, "apiKey"> = {
  similarityThreshold: 0.3,
  maxMemories: 10,
  maxProjectMemories: 5,
  injectProfile: true,
  userContainerTag: null,
  projectContainerTag: null,
};

function readJson(filePath: string): Record<string, any> | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function findProjectConfig(cwd: string): Record<string, any> | null {
  let dir = cwd;
  while (true) {
    const configPath = path.join(dir, ".cursor", ".supermemory", "config.json");
    const data = readJson(configPath);
    if (data) return data;

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadConfig(cwd?: string): Config {
  const projectConfig = findProjectConfig(cwd || process.cwd());
  const globalConfig = readJson(path.join(os.homedir(), ".config", "cursor", "supermemory.json"));

  const merged: Record<string, any> = { ...DEFAULTS, ...globalConfig, ...projectConfig };

  return {
    apiKey: process.env.SUPERMEMORY_API_KEY ?? merged.apiKey ?? null,
    similarityThreshold: merged.similarityThreshold,
    maxMemories: merged.maxMemories,
    maxProjectMemories: merged.maxProjectMemories,
    injectProfile: merged.injectProfile,
    userContainerTag: merged.userContainerTag,
    projectContainerTag: merged.projectContainerTag,
  };
}

export function getApiKey(config: Config): string | null {
  if (config.apiKey) return config.apiKey;

  const creds = loadCredentials();
  return creds?.apiKey ?? null;
}
