import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadConfig, getApiKey } from "./config.ts";
import { getUserTag, getProjectTag } from "./tags.ts";
import { createClient } from "./client.ts";

function getAuth() {
  const config = loadConfig();
  const apiKey = getApiKey(config);
  if (!apiKey) throw new Error("Not authenticated. Run `cursor-supermemory login` to connect.");
  return {
    apiKey,
    userTag: getUserTag(config),
    projectTag: getProjectTag(process.cwd(), config),
  };
}

function containerTag(auth: { userTag: string; projectTag: string }, container?: string) {
  return container === "project" ? auth.projectTag : auth.userTag;
}

const containerSchema = z.enum(["user", "project"]).default("user").optional();

export async function startMcpServer() {
  const server = new McpServer({ name: "supermemory", version: "1.0.0" });

  server.registerTool(
    "supermemory_search",
    {
      description: "Search the user's memory for relevant information.",
      inputSchema: { query: z.string(), container: containerSchema, limit: z.number().default(10) },
    },
    async ({ query, container, limit }) => {
      const auth = getAuth();
      const tag = containerTag(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.search.memories({ q: query, containerTag: tag, limit });
      const formatted = result.results.map((r) => ({
        id: r.id,
        memory: r.memory ?? r.chunk ?? "",
        similarity: r.similarity,
        updatedAt: r.updatedAt,
      }));
      return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_add",
    {
      description: "Save information to the user's memory.",
      inputSchema: { content: z.string(), container: containerSchema },
    },
    async ({ content, container }) => {
      const auth = getAuth();
      const tag = containerTag(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.add({ content, containerTag: tag });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_profile",
    {
      description: "Get the user's profile summary based on their memories.",
      inputSchema: { query: z.string().optional() },
    },
    async ({ query }) => {
      const auth = getAuth();
      const client = createClient(auth.apiKey, auth.userTag);
      const result = await client.profile({ containerTag: auth.userTag, q: query });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_list",
    {
      description: "List stored memories.",
      inputSchema: { limit: z.number().default(20), page: z.number().default(1) },
    },
    async ({ limit, page }) => {
      const auth = getAuth();
      const client = createClient(auth.apiKey, auth.userTag);
      const result = await client.documents.list({ limit, page });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.registerTool(
    "supermemory_forget",
    {
      description: "Forget a specific memory.",
      inputSchema: {
        id: z.string().optional(),
        content: z.string().optional(),
        container: containerSchema,
      },
    },
    async ({ id, content, container }) => {
      if (!id && !content) throw new Error("Provide either id or content.");
      const auth = getAuth();
      const tag = containerTag(auth, container);
      const client = createClient(auth.apiKey, tag);
      const result = await client.memories.forget({ containerTag: tag, id, content });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    },
  );

  await server.connect(new StdioServerTransport());
}
