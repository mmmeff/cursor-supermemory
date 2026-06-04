import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeHooks,
  mergeMcp,
  stripSupermemoryHooks,
  stripSupermemoryMcp,
  isSupermemoryHook,
} from "./cursorInstall.ts";

const PLUGIN_DIR = "/home/user/.cursor/plugins/local/cursor-supermemory";

describe("cursorInstall", () => {
  it("detects supermemory hook commands", () => {
    assert.equal(
      isSupermemoryHook('node "/x/cursor-supermemory/dist/stop.js"'),
      true,
    );
    assert.equal(isSupermemoryHook("node /other/stop.js"), false);
  });

  it("merges hooks without duplicating supermemory entries", () => {
    const existing = {
      version: 1,
      hooks: {
        stop: [
          { type: "command", command: 'node "/other/hook.js"', timeout: 5 },
          {
            type: "command",
            command: `node "${PLUGIN_DIR}/dist/stop.js"`,
            timeout: 99,
          },
        ],
      },
    };
    const template = {
      hooks: {
        stop: [
          {
            type: "command",
            command: 'node "${CURSOR_PLUGIN_ROOT}/dist/stop.js"',
            timeout: 120,
          },
        ],
        sessionStart: [
          {
            type: "command",
            command: 'node "${CURSOR_PLUGIN_ROOT}/dist/session-start.js"',
            timeout: 20,
          },
        ],
      },
    };

    const merged = mergeHooks(existing, template, PLUGIN_DIR);
    assert.equal(merged.hooks.stop.length, 2);
    assert.equal(merged.hooks.stop[0].command, 'node "/other/hook.js"');
    assert.equal(merged.hooks.stop[1].timeout, 120);
    assert.equal(merged.hooks.sessionStart.length, 1);
  });

  it("strips supermemory hooks and mcp entries", () => {
    const hooks = stripSupermemoryHooks({
      hooks: {
        stop: [
          { type: "command", command: `node "${PLUGIN_DIR}/dist/stop.js"` },
          { type: "command", command: "node /other.js" },
        ],
      },
    });
    assert.deepEqual(hooks.hooks, { stop: [{ type: "command", command: "node /other.js" }] });

    const mcp = stripSupermemoryMcp({
      mcpServers: {
        supermemory: { command: "node", args: [] },
        linear: { url: "https://example.com" },
      },
    });
    assert.deepEqual(mcp, { mcpServers: { linear: { url: "https://example.com" } } });
  });

  it("mergeMcp adds supermemory server", () => {
    const merged = mergeMcp({ mcpServers: { other: { url: "x" } } }, PLUGIN_DIR);
    assert.ok(merged.mcpServers.supermemory);
    assert.equal(
      (merged.mcpServers.supermemory as { args: string[] }).args[0],
      `${PLUGIN_DIR}/dist/cli.js`,
    );
  });
});
