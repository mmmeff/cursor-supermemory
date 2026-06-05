import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { latestExchange, exchangesToTranscript } from "./transcript.ts";

describe("transcript", () => {
  it("pairs the latest assistant block with its preceding user message", () => {
    const exchange = latestExchange([
      { role: "user", text: "first question" },
      { role: "assistant", text: "first answer" },
      { role: "user", text: "second question" },
      { role: "assistant", text: "part one" },
      { role: "assistant", text: "part two" },
    ]);

    assert.deepEqual(exchange, {
      user: "second question",
      assistant: "part one\npart two",
    });
  });

  it("returns null when there is no assistant turn", () => {
    assert.equal(latestExchange([{ role: "user", text: "hello" }]), null);
  });

  it("formats exchanges into a transcript string", () => {
    const transcript = exchangesToTranscript([
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ]);

    assert.equal(transcript, "User: hi\nAssistant: hello");
  });
});
