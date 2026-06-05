# cursor-supermemory

Persistent AI memory for Cursor — powered by [Supermemory](https://supermemory.ai).

## Install

```bash
npx -y github:mmmeff/cursor-supermemory login
```

This installs the npm package, runs its build, opens your browser to connect Supermemory, then prompts to install the plugin into `~/.cursor` (MCP config, rules, skills, commands, and hooks).

To install or remove the Cursor integration manually:

```bash
npx github:mmmeff/cursor-supermemory install
npx github:mmmeff/cursor-supermemory uninstall
```

Reload Cursor after install or uninstall.

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
| `beforeSubmitPrompt` | Derives two extra recall queries via Composer 2.5, searches memory with all three, writes `.cursor/.supermemory/current-recall.md`, and stages recall for hook injection |
| `afterAgentThought` | Stores recent thinking to enrich mid-turn recall query generation |
| `postToolUse` | Injects turn-start recall on the first tool; refreshes topical recall on a cadence mid-turn, rewrites `current-recall.md`, and injects via `additional_context` |
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

Per-turn and mid-turn recall use the Agent CLI to derive extra memory search queries. Without it, recall falls back to searching with the user's message only. Mid-turn refresh also skips when disabled via config.

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

Settings merge in this order (later wins): **defaults → global config → project config**, with **environment variables** overriding config-file values where noted below. The API key has its own precedence chain.

### Authentication and API key

| Source | Location | Notes |
|---|---|---|
| Login (recommended) | `~/.supermemory-cursor/credentials.json` | Created by `cursor-supermemory login` |
| Environment | `SUPERMEMORY_API_KEY` | Overrides all other API key sources |
| Project config | `.cursor/.supermemory/config.json` → `apiKey` | Per-workspace override; do not commit |
| Global config | `~/.config/cursor/supermemory.json` → `apiKey` | Optional user-wide override |

`supermemory_set_config` cannot set `apiKey` — use login, an env var, or edit a config file manually.

### Environment variables

| Variable | Config equivalent | Description |
|---|---|---|
| `SUPERMEMORY_API_KEY` | `apiKey` | API key (highest precedence) |
| `SUPERMEMORY_USER_TAG` | `userContainerTag` | Override the personal memory container tag |
| `SUPERMEMORY_PROJECT_TAG` | `projectContainerTag` | Override the project memory container tag |
| `CURSOR_USER_EMAIL` | — | Used to derive the user container tag when no explicit tag is set |

Env vars override config-file values for container tags. If no tag is set explicitly, tags are auto-derived (see [Container tags](#container-tags)).

### Config files

| File | Scope |
|---|---|
| `~/.config/cursor/supermemory.json` | Global — defaults for all projects |
| `.cursor/.supermemory/config.json` | Project — overrides global for this workspace |

Project config wins over global config. Add `.cursor/.supermemory/config.json` to `.gitignore` when it contains an `apiKey`. A file with only shared `projectContainerTag` and non-secret defaults is safe to commit.

**Global example** — `~/.config/cursor/supermemory.json`:

```json
{
  "userContainerTag": "my-personal-tag",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 10,
  "injectProfile": true,
  "midTurnRecallEnabled": true,
  "midTurnRecallEveryNTools": 5,
  "midTurnRecallMinIntervalMs": 15000,
  "midTurnRecallMaxPerTurn": 2,
  "midTurnRecallRecentTools": 5
}
```

**Project example** — `.cursor/.supermemory/config.json`:

```json
{
  "apiKey": "sm_...",
  "projectContainerTag": "my-team-backend",
  "userContainerTag": "my-personal-tag",
  "similarityThreshold": 0.3,
  "maxMemories": 10,
  "maxProjectMemories": 10,
  "injectProfile": true,
  "midTurnRecallEnabled": true,
  "midTurnRecallEveryNTools": 5,
  "midTurnRecallMinIntervalMs": 15000,
  "midTurnRecallMaxPerTurn": 2,
  "midTurnRecallRecentTools": 5
}
```

### Config options reference

| Option | Type | Default | Used by | Description |
|---|---|---|---|---|
| `apiKey` | string | — | All API calls | Supermemory API key. Project or global config file only (not via `supermemory_set_config`). |
| `userContainerTag` | string | auto | MCP tools, hooks | Explicit personal memory container tag. Overrides env/git/machine derivation. |
| `projectContainerTag` | string | auto | MCP tools, hooks | Explicit project memory container tag. Commit when a team should share one bucket. |
| `similarityThreshold` | number | `0.3` | Turn-start and mid-turn recall search | Minimum similarity score (0–1) for search hits to be included. |
| `maxMemories` | integer | `10` | Turn-start and mid-turn recall search | Max memories returned after merging multi-query search results. |
| `maxProjectMemories` | integer | `10` | `sessionStart` | Max recent project notes listed at session start. |
| `injectProfile` | boolean | `true` | `sessionStart` | Whether to include the aggregated user profile in session-start context. |
| `midTurnRecallEnabled` | boolean | `true` | `postToolUse` | Enable topical recall refresh mid-turn as the agent uses tools. |
| `midTurnRecallEveryNTools` | integer | `5` | `postToolUse` | Run a mid-turn refresh every N tool calls within one user message. |
| `midTurnRecallMinIntervalMs` | integer | `15000` | `postToolUse` | Minimum milliseconds between mid-turn refreshes. |
| `midTurnRecallMaxPerTurn` | integer | `2` | `postToolUse` | Max mid-turn LLM + search refreshes per user message. |
| `midTurnRecallRecentTools` | integer | `5` | `postToolUse`, `afterAgentThought` | Number of recent tool summaries included in mid-turn query generation. |

Set options via `supermemory_set_config` (except `apiKey`), or edit the config files above manually. Use `supermemory_get_config` to inspect effective values, resolved container tags, and config file paths.

## Container tags

By default, container tags are derived automatically:

- **User tag** — hashed from your git email, `CURSOR_USER_EMAIL`, or machine id. Consistent across projects.
- **Project tag** — hashed from your git repo root (or cwd). Stable for one checkout, but absolute paths can differ across teammates.

To share project memory with your team, commit the same `projectContainerTag` in project config. Do not commit `apiKey`; each developer's API key should stay local.

## Development

```bash
npm install
npm run build   # compiles all dist/ files
npm test        # unit tests
npm run smoke   # verify bundled hooks have no external imports
```

### Testing locally (without the marketplace)

1. **Open this repo in Cursor** — rules, commands, skills, and hooks are picked up from `.cursor-plugin`.
2. **Build:** `npm run build`
3. **Use the local MCP server** — `.cursor/mcp.json` in this repo points to `dist/` automatically.
4. **Log in:** `npm run dev -- login` or `node dist/cli.js login` after build
5. **Restart Cursor** after changing `.cursor/mcp.json`.

To test in a different project, add the `supermemory` entry from `.cursor/mcp.json` to that project's MCP config with an absolute path to `dist/mcp-server.js`.

From a dev checkout, run `npm run build` then `node dist/cli.js install` to copy assets into `~/.cursor/plugins/local/cursor-supermemory` and update `~/.cursor/hooks.json` and `~/.cursor/mcp.json`.
