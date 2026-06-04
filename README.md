# cursor-supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Install

```bash
npx github:mmmeff/cursor-supermemory login
```

This installs the package from the repo and runs its build automatically, then opens your browser to connect Supermemory.

## What it does

- **Active memory hooks** — recalls relevant context as you work and captures distilled learnings automatically
- **Distilled capture** — extracts concise project/user learnings instead of uploading raw chat transcripts
- **MCP tools** — available in every Cursor AI session for explicit memory control
- **Always-on rule** — reminds the AI to use memory tools proactively

## Automatic memory

The plugin uses Cursor hooks to keep memory useful without manual prompts:

| Hook | Behavior |
|---|---|
| `sessionStart` | Injects ambient context: your user profile plus the most recent project notes |
| `beforeSubmitPrompt` | Searches project memory with the current prompt and stages relevant recall |
| `postToolUse` | Injects staged recall once per turn via `additional_context` |
| `stop` | Buffers completed turns and distills them every 3 turns |
| `preCompact` | Flushes buffered turns before Cursor compacts context |
| `sessionEnd` | Final sweep for any buffered turns |

Automatic capture does **not** store full transcripts. It runs a local Cursor Agent CLI completion (`composer-2.5`) to extract:

- **Project learnings** — durable codebase facts, conventions, architecture decisions, commands, gotchas, and bug root causes
- **User learnings** — durable personal preferences and cross-project workflow facts

Project learnings are saved to the project container; user learnings are saved to the user container. If the Cursor Agent CLI is missing, not authenticated, or fails, automatic capture skips persistence rather than falling back to raw transcript storage.

### Cursor Agent CLI requirement

Distilled automatic capture uses the local Cursor Agent CLI (`agent`) so it can reuse your existing Cursor login without requiring a separate model API key.

```bash
agent status
```

If `agent` is not installed or authenticated, install/login with Cursor's CLI flow, then restart or reload Cursor. MCP tools still work without the Agent CLI; only automatic distilled capture depends on it.

## MCP Tools

| Tool | Description |
|---|---|
| `supermemory_get_config` | Show current config, resolved container tags, and config file paths |
| `supermemory_set_config` | Update config at project or global scope |
| `supermemory_containers` | Show what `user` and `project` container tags resolve to |
| `supermemory_search` | Search memories by query |
| `supermemory_add` | Save new information to memory |
| `supermemory_list` | List stored memories |
| `supermemory_forget` | Delete a memory by id or content |
| `supermemory_profile` | Get your user profile summary |

All tools that accept a `container` argument support:
- `"user"` (default) — personal memory, shared across all projects
- `"project"` — scoped to the current workspace
- any custom string — used as a raw container tag

## Configuration

### Environment variables

| Variable | Description |
|---|---|
| `SUPERMEMORY_API_KEY` | API key (overrides all other sources) |
| `SUPERMEMORY_USER_TAG` | Override the personal container tag |
| `SUPERMEMORY_PROJECT_TAG` | Override the project container tag |
| `CURSOR_USER_EMAIL` | Used to derive the user container tag |

### Global config — `~/.config/cursor/supermemory.json`

User-wide defaults, applies to all projects.

```json
{
  "userContainerTag": "my-personal-tag",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true
}
```

### Project config — `.cursor/.supermemory/config.json`

Per-workspace overrides. Add to `.gitignore` if it contains an API key. Project config wins over global config.

```json
{
  "apiKey": "sm_...",
  "projectContainerTag": "my-team-backend",
  "userContainerTag": "my-personal-tag",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 5,
  "injectProfile": true
}
```

| Option | Description | Default |
|---|---|---|
| `apiKey` | Project-specific API key | — |
| `userContainerTag` | Override personal memory container | auto-derived from git email / machine id |
| `projectContainerTag` | Override project memory container. Commit this when your team should share one project memory bucket. | auto-derived from git root / cwd |
| `similarityThreshold` | Minimum similarity score for search results | `0.3` |
| `maxMemories` | Max project memories injected at session start | `10` |
| `maxProjectMemories` | Max project memories injected at session start | `5` |
| `injectProfile` | Whether to inject user profile at session start | `true` |

You can set these via the AI using `supermemory_set_config`, or create/edit the file manually.

## Container tags

By default, container tags are derived automatically:

- **User tag** — hashed from your git email, `CURSOR_USER_EMAIL`, or machine id. Consistent across projects.
- **Project tag** — hashed from your git repo root (or cwd). Stable for one checkout, but absolute paths can differ across teammates.

To share project memory with your team, commit the same `projectContainerTag` in project config. Do not commit `apiKey`; each developer's API key should stay local.

## Development

```bash
npm install
npm run build   # compiles all dist/ files
```

### Testing locally (without the marketplace)

1. **Open this repo in Cursor** — rules, commands, skills, and hooks are picked up from `.cursor-plugin`.
2. **Build:** `npm run build`
3. **Use the local MCP server** — `.cursor/mcp.json` in this repo points to `dist/` automatically.
4. **Log in:** `npm run dev -- login` or `node dist/cli.js login` after build
5. **Restart Cursor** after changing `.cursor/mcp.json`.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to that project's MCP config with an absolute path to `dist/mcp-server.js`.

For local hook testing outside the marketplace, Cursor may need explicit user-level hook registration. Add the built hook commands to `~/.cursor/hooks.json` with absolute paths to this repo's `dist/*.js`, then reload Cursor.
