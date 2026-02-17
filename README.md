# cursor-supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Install

Install from the [Cursor Marketplace](https://cursor.com/marketplace), then authenticate:

```bash
bunx cursor-supermemory@latest login
```

## What it does

- **MCP tools** — 5 tools available in every Cursor AI session:
  - `supermemory_search` — search past memories
  - `supermemory_add` — save new memories
  - `supermemory_profile` — get your user profile
  - `supermemory_list` — list recent memories
  - `supermemory_forget` — delete a memory
- **Session hooks** — automatically injects relevant memories at session start; saves conversation highlights at session end
- **Always-on rule** — reminds the AI to use memory tools proactively

## Configuration

| Variable | Description |
|---|---|
| `SUPERMEMORY_API_KEY` | API key (highest priority) |
| `CURSOR_USER_EMAIL` | Used for user container tag |
| `CURSOR_PROJECT_DIR` | Used for project container tag |
| `SUPERMEMORY_DEBUG` | Set to `1` for debug logging |

Project config: `.cursor/.supermemory/config.json` (add to `.gitignore`)

## Development

```bash
bun install
bun run build   # compiles all dist/ files
```

### Testing locally (without the marketplace)

1. **Open this repo in Cursor** — the plugin’s rules, commands, skills, and hooks are picked up from the `.cursor-plugin` in the repo.

2. **Build the plugin:**
   ```bash
   bun run build
   ```

3. **Use the local MCP server** — this repo includes `.cursor/mcp.json` that runs the built MCP server from `dist/` instead of the published npm package. With this repo as your workspace, Cursor will use that config and the Supermemory MCP tools will talk to your local build.

4. **Log in** (if you haven’t already):
   ```bash
   bunx cursor-supermemory@latest login
   ```
   Or run the CLI from the repo:
   ```bash
   bun run src/cli.ts login
   ```

5. **Restart Cursor** after changing `.cursor/mcp.json` so MCP config is reloaded.

To test in a different project while still using your local plugin build, add the same `supermemory` entry from this repo’s `.cursor/mcp.json` to that project’s `.cursor/mcp.json`, and set `args` to the absolute path to this repo’s `dist/mcp-server.js`.
