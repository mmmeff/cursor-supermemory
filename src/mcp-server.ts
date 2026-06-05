import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, getProjectConfigPath, GLOBAL_CONFIG_PATH, writeConfig, type ConfigUpdates } from "./config.ts";
import { resolveAuth, resolveContainerTag, type AuthContext } from "./authContext.ts";
import { createClient } from "./client.ts";
import { getRecallFilePath } from "./recallFile.ts";
import { memoryBody } from "./memoryText.ts";

function requireAuth(): AuthContext {
  const auth = resolveAuth();
  if (!auth) throw new Error("Not authenticated. Run `cursor-supermemory login` to connect.");
  return auth;
}

const containerSchema = z
  .string()
  .optional()
  .describe('Container to use: "user" (default), "project" (current project), or any custom tag string');

function textResult(data: unknown) {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text" as const, text }] };
}

export async function startMcpServer() {
  const server = new McpServer({ name: "supermemory", version: "1.0.0" });

  server.registerTool(
    "supermemory_get_config",
    {
      description:
        "Show the current supermemory configuration — effective settings, resolved container tags, and config file paths.",
      inputSchema: {},
    },
    async () => {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      const auth = requireAuth();
      return textResult({
        effectiveConfig: {
          userContainerTag: config.userContainerTag ?? "(auto-derived from git email / machine id)",
          projectContainerTag: config.projectContainerTag ?? "(auto-derived from git root / cwd)",
          similarityThreshold: config.similarityThreshold,
          maxMemories: config.maxMemories,
          maxProjectMemories: config.maxProjectMemories,
          injectProfile: config.injectProfile,
          midTurnRecallEnabled: config.midTurnRecallEnabled,
          midTurnRecallEveryNTools: config.midTurnRecallEveryNTools,
          midTurnRecallMinIntervalMs: config.midTurnRecallMinIntervalMs,
          midTurnRecallMaxPerTurn: config.midTurnRecallMaxPerTurn,
          midTurnRecallRecentTools: config.midTurnRecallRecentTools,
        },
        resolvedTags: {
          user: auth.userTag,
          project: auth.projectTag,
        },
        recallFilePath: getRecallFilePath(auth.projectTag),
        configFiles: {
          project: getProjectConfigPath(cwd),
          global: GLOBAL_CONFIG_PATH,
        },
      });
    },
  );

  server.registerTool(
    "supermemory_set_config",
    {
      description:
        "Update supermemory configuration. Use scope='project' to set per-workspace overrides (saved to .cursor/.supermemory/config.json), or scope='global' for user-wide defaults.",
      inputSchema: {
        scope: z.enum(["project", "global"]).default("project"),
        userContainerTag: z.string().optional().describe("Override the personal memory container tag"),
        projectContainerTag: z.string().optional().describe("Override the project/workspace memory container tag"),
        similarityThreshold: z.number().min(0).max(1).optional(),
        maxMemories: z.number().int().positive().optional(),
        maxProjectMemories: z.number().int().positive().optional(),
        injectProfile: z.boolean().optional(),
        midTurnRecallEnabled: z.boolean().optional(),
        midTurnRecallEveryNTools: z.number().int().positive().optional(),
        midTurnRecallMinIntervalMs: z.number().int().nonnegative().optional(),
        midTurnRecallMaxPerTurn: z.number().int().nonnegative().optional(),
        midTurnRecallRecentTools: z.number().int().positive().optional(),
      },
    },
    async ({ scope, ...updates }) => {
      const filtered = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      ) as ConfigUpdates;
      if (Object.keys(filtered).length === 0) throw new Error("No config values provided.");
      writeConfig(filtered, scope);
      const cwd = process.cwd();
      const filePath = scope === "project" ? getProjectConfigPath(cwd) : GLOBAL_CONFIG_PATH;
      return textResult(`Config updated (${scope}): ${filePath}\n${JSON.stringify(filtered, null, 2)}`);
    },
  );

  server.registerTool(
    "supermemory_containers",
    {
      description:
        "Show the available container tags. Use these as the `container` argument in other tools. " +
        '"user" is personal memory, "project" is scoped to the current workspace.',
      inputSchema: {},
    },
    async () => {
      const auth = requireAuth();
      return textResult({
        user: { alias: "user", tag: auth.userTag, description: "Personal memories across all projects" },
        project: { alias: "project", tag: auth.projectTag, description: "Memories scoped to this workspace" },
      });
    },
  );

  server.registerTool(
    "supermemory_search",
    {
      description:
        'Search memories. Use container="user" for personal, "project" for workspace, or pass a custom tag.',
      inputSchema: { query: z.string(), container: containerSchema, limit: z.number().default(10) },
    },
    async ({ query, container, limit }) => {
      const auth = requireAuth();
      const tag = resolveContainerTag(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.search.memories({ q: query, containerTag: tag, limit });
      return textResult(result.results.map((r) => ({
        id: r.id,
        memory: memoryBody(r),
        similarity: r.similarity,
        updatedAt: r.updatedAt,
      })));
    },
  );

  server.registerTool(
    "supermemory_add",
    {
      description:
        'Save information to memory. Use container="user" for personal, "project" for workspace, or a custom tag.',
      inputSchema: { content: z.string(), container: containerSchema },
    },
    async ({ content, container }) => {
      const auth = requireAuth();
      const tag = resolveContainerTag(auth, container);
      const result = await createClient(auth.apiKey, tag).add({ content, containerTag: tag });
      return textResult(result);
    },
  );

  server.registerTool(
    "supermemory_profile",
    {
      description: "Get the user's profile summary based on their personal memories.",
      inputSchema: { query: z.string().optional() },
    },
    async ({ query }) => {
      const auth = requireAuth();
      const result = await createClient(auth.apiKey, auth.userTag).profile({ containerTag: auth.userTag, q: query });
      return textResult(result);
    },
  );

  server.registerTool(
    "supermemory_list",
    {
      description: "List stored memories, optionally filtered by container.",
      inputSchema: { limit: z.number().default(20), page: z.number().default(1), container: containerSchema },
    },
    async ({ limit, page, container }) => {
      const auth = requireAuth();
      const tag = resolveContainerTag(auth, container);
      const result = await createClient(auth.apiKey, tag).documents.list({ limit, page });
      return textResult(result);
    },
  );

  server.registerTool(
    "supermemory_forget",
    {
      description: "Forget a specific memory by id or content.",
      inputSchema: {
        id: z.string().optional(),
        content: z.string().optional(),
        container: containerSchema,
      },
    },
    async ({ id, content, container }) => {
      if (!id && !content) throw new Error("Provide either id or content.");
      const auth = requireAuth();
      const tag = resolveContainerTag(auth, container);
      const result = await createClient(auth.apiKey, tag).memories.forget({ containerTag: tag, id, content });
      return textResult(result);
    },
  );

  await server.connect(new StdioServerTransport());
}
