import * as readline from "node:readline/promises";

/** Interactive y/n prompt; empty input counts as yes. Returns false when not a TTY. */
export async function confirmDefaultYes(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.log("Non-interactive — skipped. Run: cursor-supermemory install");
    return false;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question(`${question} [Y/n] `);
    const trimmed = answer.trim().toLowerCase();
    return !trimmed || trimmed === "y" || trimmed === "yes";
  } finally {
    rl.close();
  }
}
