import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PLUGIN_ID = "cursor-supermemory";
export const PLUGIN_INSTALL_DIR = join(homedir(), ".cursor", "plugins", "local", PLUGIN_ID);
const CURSOR_DIR = join(homedir(), ".cursor");
const CURSOR_HOOKS_PATH = join(CURSOR_DIR, "hooks.json");
const CURSOR_MCP_PATH = join(CURSOR_DIR, "mcp.json");

const ASSET_DIRS = ["rules", "skills", "commands", "hooks", ".cursor-plugin"] as const;
const HOOK_MARKER = "cursor-supermemory/dist/";

interface HookEntry {
  type: string;
  command: string;
  timeout?: number;
}

interface HooksFile {
  version?: number;
  hooks: Record<string, HookEntry[]>;
}

interface McpFile {
  mcpServers: Record<string, unknown>;
}

export function getPackageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), "..");
}

export function isPluginInstalled(): boolean {
  return existsSync(join(PLUGIN_INSTALL_DIR, "dist", "cli.js"));
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export function isSupermemoryHook(command: string): boolean {
  return command.includes(HOOK_MARKER);
}

function resolveHookCommand(template: string, pluginDir: string): string {
  return template.replace(/\$\{CURSOR_PLUGIN_ROOT\}/g, pluginDir);
}

function loadTemplateHooks(packageRoot: string): HooksFile {
  const path = join(packageRoot, "hooks", "hooks.json");
  if (!existsSync(path)) {
    throw new Error(`Missing hooks template at ${path}`);
  }
  return readJson<HooksFile>(path)!;
}

export function mergeHooks(existing: HooksFile | null, template: HooksFile, pluginDir: string): HooksFile {
  const merged: HooksFile = {
    version: 1,
    hooks: { ...(existing?.hooks ?? {}) },
  };

  for (const [event, entries] of Object.entries(template.hooks)) {
    const kept = (merged.hooks[event] ?? []).filter((e) => !isSupermemoryHook(e.command));
    const added = entries.map((entry) => ({
      ...entry,
      command: resolveHookCommand(entry.command, pluginDir),
    }));
    merged.hooks[event] = [...kept, ...added];
  }

  return merged;
}

export function stripSupermemoryHooks(file: HooksFile): HooksFile {
  const hooks: Record<string, HookEntry[]> = {};
  for (const [event, entries] of Object.entries(file.hooks)) {
    const kept = entries.filter((e) => !isSupermemoryHook(e.command));
    if (kept.length > 0) hooks[event] = kept;
  }
  return { version: file.version ?? 1, hooks };
}

export function buildMcpEntry(pluginDir: string): McpFile["mcpServers"] {
  return {
    supermemory: {
      command: "node",
      args: [join(pluginDir, "dist", "cli.js"), "mcp"],
    },
  };
}

export function mergeMcp(existing: McpFile | null, pluginDir: string): McpFile {
  return {
    mcpServers: {
      ...(existing?.mcpServers ?? {}),
      ...buildMcpEntry(pluginDir),
    },
  };
}

export function stripSupermemoryMcp(file: McpFile): McpFile | null {
  const { supermemory: _removed, ...rest } = file.mcpServers;
  if (Object.keys(rest).length === 0) return null;
  return { mcpServers: rest };
}

function copyPluginAssets(packageRoot: string): void {
  const distSrc = join(packageRoot, "dist");
  if (!existsSync(join(distSrc, "cli.js"))) {
    throw new Error("dist/ is missing — run `npm run build` first");
  }

  rmSync(PLUGIN_INSTALL_DIR, { recursive: true, force: true });
  mkdirSync(PLUGIN_INSTALL_DIR, { recursive: true });

  for (const dir of ASSET_DIRS) {
    const src = join(packageRoot, dir);
    if (existsSync(src)) {
      cpSync(src, join(PLUGIN_INSTALL_DIR, dir), { recursive: true });
    }
  }

  cpSync(distSrc, join(PLUGIN_INSTALL_DIR, "dist"), { recursive: true });

  const mcpConfig: McpFile = { mcpServers: buildMcpEntry(PLUGIN_INSTALL_DIR) };
  writeJson(join(PLUGIN_INSTALL_DIR, ".mcp.json"), mcpConfig);

  const pluginManifestPath = join(PLUGIN_INSTALL_DIR, ".cursor-plugin", "plugin.json");
  if (existsSync(pluginManifestPath)) {
    const manifest = readJson<Record<string, unknown>>(pluginManifestPath)!;
    manifest.mcpServers = ".mcp.json";
    manifest.hooks = "hooks";
    writeJson(pluginManifestPath, manifest);
  }
}

export type InstallResult = { ok: true; message: string } | { ok: false; message: string };

export function installPlugin(): InstallResult {
  try {
    const packageRoot = getPackageRoot();
    copyPluginAssets(packageRoot);

    const templateHooks = loadTemplateHooks(packageRoot);
    const userHooks = readJson<HooksFile>(CURSOR_HOOKS_PATH);
    writeJson(CURSOR_HOOKS_PATH, mergeHooks(userHooks, templateHooks, PLUGIN_INSTALL_DIR));

    const userMcp = readJson<McpFile>(CURSOR_MCP_PATH);
    writeJson(CURSOR_MCP_PATH, mergeMcp(userMcp, PLUGIN_INSTALL_DIR));

    return {
      ok: true,
      message: [
        `Installed to ${PLUGIN_INSTALL_DIR}`,
        `Updated ${CURSOR_HOOKS_PATH}`,
        `Updated ${CURSOR_MCP_PATH}`,
        "Reload Cursor to apply changes.",
      ].join("\n"),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

export function uninstallPlugin(): InstallResult {
  try {
    if (existsSync(CURSOR_HOOKS_PATH)) {
      const hooks = readJson<HooksFile>(CURSOR_HOOKS_PATH);
      if (hooks) writeJson(CURSOR_HOOKS_PATH, stripSupermemoryHooks(hooks));
    }

    if (existsSync(CURSOR_MCP_PATH)) {
      const mcp = readJson<McpFile>(CURSOR_MCP_PATH);
      if (mcp) {
        const stripped = stripSupermemoryMcp(mcp);
        if (stripped) writeJson(CURSOR_MCP_PATH, stripped);
        else rmSync(CURSOR_MCP_PATH);
      }
    }

    if (existsSync(PLUGIN_INSTALL_DIR)) {
      rmSync(PLUGIN_INSTALL_DIR, { recursive: true, force: true });
    }

    return {
      ok: true,
      message: "Removed Supermemory from Cursor. Reload Cursor to apply changes.",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}
