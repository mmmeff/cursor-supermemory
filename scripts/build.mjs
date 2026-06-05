import * as esbuild from "esbuild";

const hookEntries = [
  ["src/hooks/session-start.ts", "dist/session-start.js"],
  ["src/hooks/session-end.ts", "dist/session-end.js"],
  ["src/hooks/before-submit-prompt.ts", "dist/before-submit-prompt.js"],
  ["src/hooks/post-tool-use.ts", "dist/post-tool-use.js"],
  ["src/hooks/stop.ts", "dist/stop.js"],
  ["src/hooks/pre-compact.ts", "dist/pre-compact.js"],
];

const hostedEntries = [
  ["src/cli.ts", "dist/cli.js"],
  ["src/mcp-server.ts", "dist/mcp-server.js"],
];

async function buildEntry(entryPoints, outfile, { bundleDeps }) {
  return esbuild.build({
    entryPoints: [entryPoints],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    ...(bundleDeps ? {} : { packages: "external" }),
  });
}

// Hooks run from ~/.cursor/plugins/... with no node_modules — bundle deps in.
await Promise.all(
  hookEntries.map(([entry, outfile]) => buildEntry(entry, outfile, { bundleDeps: true })),
);

// CLI/MCP also run from the install dir without node_modules.
await Promise.all(
  hostedEntries.map(([entry, outfile]) => buildEntry(entry, outfile, { bundleDeps: true })),
);
