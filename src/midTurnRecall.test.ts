import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Config } from "./config.ts";
import {
  buildTrajectoryContext,
  resetMidTurnStateForNewPrompt,
  shouldRefreshMidTurnRecall,
  summarizeToolUse,
  syncGenerationSession,
} from "./midTurnRecall.ts";
import { loadSession, type SessionState } from "./sessionStore.ts";

function midTurnConfig(overrides: Partial<Config> = {}): Config {
  return {
    apiKey: null,
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
    ...overrides,
  };
}

function baseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    ...loadSession("conv-1"),
    conversationId: "conv-1",
    userPromptThisGeneration: "fix the auth hook race",
    generationId: "gen-1",
    ...overrides,
  };
}

describe("midTurnRecall", () => {
  it("resets generation-scoped state for a new prompt", () => {
    const session = baseSession({
      generationId: "gen-old",
      toolCountThisGeneration: 7,
      midTurnRefreshCountThisGeneration: 1,
      recentTools: ["Read(foo)"],
      thoughtSnippet: "thinking",
    });

    resetMidTurnStateForNewPrompt(session, "new prompt");

    assert.equal(session.userPromptThisGeneration, "new prompt");
    assert.equal(session.generationId, null);
    assert.equal(session.toolCountThisGeneration, 0);
    assert.equal(session.midTurnRefreshCountThisGeneration, 0);
    assert.deepEqual(session.recentTools, []);
    assert.equal(session.thoughtSnippet, null);
  });

  it("syncs generation without clearing the stored user prompt", () => {
    const session = baseSession({ generationId: "gen-1", toolCountThisGeneration: 3 });
    syncGenerationSession(session, "gen-2");

    assert.equal(session.generationId, "gen-2");
    assert.equal(session.toolCountThisGeneration, 0);
    assert.equal(session.userPromptThisGeneration, "fix the auth hook race");
  });

  it("refreshes on cadence with interval and per-turn caps", () => {
    const config = midTurnConfig();
    const now = 100_000;

    assert.equal(
      shouldRefreshMidTurnRecall(
        baseSession({ toolCountThisGeneration: 5, lastMidTurnRefreshMs: 0 }),
        config,
        now,
      ),
      true,
    );

    assert.equal(
      shouldRefreshMidTurnRecall(
        baseSession({
          toolCountThisGeneration: 5,
          lastMidTurnRefreshMs: now - 5_000,
        }),
        config,
        now,
      ),
      false,
    );

    assert.equal(
      shouldRefreshMidTurnRecall(
        baseSession({
          toolCountThisGeneration: 10,
          midTurnRefreshCountThisGeneration: 2,
          lastMidTurnRefreshMs: now - 20_000,
        }),
        config,
        now,
      ),
      false,
    );
  });

  it("summarizes common tool shapes compactly", () => {
    assert.match(
      summarizeToolUse("Read", { path: "/src/hooks/post-tool-use.ts" }, undefined),
      /Read\(\/src\/hooks\/post-tool-use\.ts\)/,
    );
    assert.match(
      summarizeToolUse("Shell", { command: "npm test" }, '{"stdout":"ok"}'),
      /npm test/,
    );
  });

  it("builds trajectory context from prompt, thought, and recent tools", () => {
    const context = buildTrajectoryContext(
      baseSession({
        thoughtSnippet: "Looks like a hook timing issue",
        recentTools: ["Read(src/hooks/post-tool-use.ts)", "Grep(additional_context)"],
      }),
      5,
    );

    assert.match(context, /fix the auth hook race/);
    assert.match(context, /hook timing issue/);
    assert.match(context, /Recent tool activity/);
  });
});
