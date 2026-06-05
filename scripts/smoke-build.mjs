import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const distDir = join(root, "dist");

const hookArtifacts = [
  "session-start.js",
  "session-end.js",
  "before-submit-prompt.js",
  "post-tool-use.js",
  "after-agent-thought.js",
  "stop.js",
  "pre-compact.js",
];

const externalImportPattern = /from\s+["'](?!node:|\.)([^"']+)["']/g;

for (const artifact of hookArtifacts) {
  const path = join(distDir, artifact);
  const source = readFileSync(path, "utf-8");

  for (const match of source.matchAll(externalImportPattern)) {
    throw new Error(`${artifact} has unresolved external import: ${match[1]}`);
  }

  const result = spawnSync(process.execPath, [path], {
    input: "{}",
    encoding: "utf-8",
  });

  if (result.status !== 0) {
    throw new Error(`${artifact} smoke test failed:\n${result.stderr}`);
  }
}

console.log(`Smoke-tested ${hookArtifacts.length} hook bundles.`);
