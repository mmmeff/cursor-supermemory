import path from "node:path";
import os from "node:os";
import { readJsonFile, writeJsonFile } from "./jsonFile.ts";
import { loadCredentials } from "./auth.ts";

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), ".config", "cursor", "supermemory.json");

export function getProjectConfigPath(cwd: string): string {
  return path.join(cwd, ".cursor", ".supermemory", "config.json");
}

export type ConfigUpdates = Partial<Omit<Config, "apiKey">>;

export function writeConfig(updates: ConfigUpdates, scope: "project" | "global", cwd = process.cwd()): void {
  const filePath = scope === "project" ? getProjectConfigPath(cwd) : GLOBAL_CONFIG_PATH;
  const existing = readJsonFile<Record<string, unknown>>(filePath) ?? {};
  writeJsonFile(filePath, { ...existing, ...updates });
}

export interface Config {
  apiKey: string | null;
  similarityThreshold: number;
  maxMemories: number;
  maxProjectMemories: number;
  injectProfile: boolean;
  userContainerTag: string | null;
  projectContainerTag: string | null;
  midTurnRecallEnabled: boolean;
  midTurnRecallEveryNTools: number;
  midTurnRecallMinIntervalMs: number;
  midTurnRecallMaxPerTurn: number;
  midTurnRecallRecentTools: number;
}

const DEFAULTS: Omit<Config, "apiKey"> = {
  similarityThreshold: 0.3,
  maxMemories: 10,
  maxProjectMemories: 10,
  injectProfile: true,
  userContainerTag: null,
  projectContainerTag: null,
  midTurnRecallEnabled: true,
  midTurnRecallEveryNTools: 5,
  midTurnRecallMinIntervalMs: 15_000,
  midTurnRecallMaxPerTurn: 2,
  midTurnRecallRecentTools: 5,
};

export function parseConfigFields(raw: Record<string, unknown> | null): Partial<Config> {
  if (!raw) return {};

  const out: Partial<Config> = {};
  if (typeof raw.apiKey === "string") out.apiKey = raw.apiKey;
  if (typeof raw.similarityThreshold === "number") out.similarityThreshold = raw.similarityThreshold;
  if (typeof raw.maxMemories === "number") out.maxMemories = raw.maxMemories;
  if (typeof raw.maxProjectMemories === "number") out.maxProjectMemories = raw.maxProjectMemories;
  if (typeof raw.injectProfile === "boolean") out.injectProfile = raw.injectProfile;
  if (typeof raw.userContainerTag === "string") out.userContainerTag = raw.userContainerTag;
  if (typeof raw.projectContainerTag === "string") out.projectContainerTag = raw.projectContainerTag;
  if (typeof raw.midTurnRecallEnabled === "boolean") out.midTurnRecallEnabled = raw.midTurnRecallEnabled;
  if (typeof raw.midTurnRecallEveryNTools === "number") out.midTurnRecallEveryNTools = raw.midTurnRecallEveryNTools;
  if (typeof raw.midTurnRecallMinIntervalMs === "number") {
    out.midTurnRecallMinIntervalMs = raw.midTurnRecallMinIntervalMs;
  }
  if (typeof raw.midTurnRecallMaxPerTurn === "number") out.midTurnRecallMaxPerTurn = raw.midTurnRecallMaxPerTurn;
  if (typeof raw.midTurnRecallRecentTools === "number") {
    out.midTurnRecallRecentTools = raw.midTurnRecallRecentTools;
  }
  return out;
}

function findProjectConfig(cwd: string): Partial<Config> | null {
  let dir = cwd;
  while (true) {
    const configPath = path.join(dir, ".cursor", ".supermemory", "config.json");
    const data = readJsonFile<Record<string, unknown>>(configPath);
    if (data) return parseConfigFields(data);

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadConfig(cwd?: string): Config {
  const projectConfig = findProjectConfig(cwd || process.cwd());
  const globalConfig = parseConfigFields(readJsonFile<Record<string, unknown>>(GLOBAL_CONFIG_PATH));

  const merged = { ...DEFAULTS, ...globalConfig, ...projectConfig };

  return {
    apiKey: process.env.SUPERMEMORY_API_KEY ?? merged.apiKey ?? null,
    similarityThreshold: merged.similarityThreshold,
    maxMemories: merged.maxMemories,
    maxProjectMemories: merged.maxProjectMemories,
    injectProfile: merged.injectProfile,
    userContainerTag: merged.userContainerTag,
    projectContainerTag: merged.projectContainerTag,
    midTurnRecallEnabled: merged.midTurnRecallEnabled,
    midTurnRecallEveryNTools: merged.midTurnRecallEveryNTools,
    midTurnRecallMinIntervalMs: merged.midTurnRecallMinIntervalMs,
    midTurnRecallMaxPerTurn: merged.midTurnRecallMaxPerTurn,
    midTurnRecallRecentTools: merged.midTurnRecallRecentTools,
  };
}

export function getApiKey(config: Config): string | null {
  if (config.apiKey) return config.apiKey;

  const creds = loadCredentials();
  return creds?.apiKey ?? null;
}
