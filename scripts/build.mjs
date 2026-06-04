import * as esbuild from "esbuild";

const entries = [
  ["src/cli.ts", "dist/cli.js"],
  ["src/mcp-server.ts", "dist/mcp-server.js"],
  ["src/hooks/session-start.ts", "dist/session-start.js"],
  ["src/hooks/session-end.ts", "dist/session-end.js"],
  ["src/hooks/before-submit-prompt.ts", "dist/before-submit-prompt.js"],
  ["src/hooks/post-tool-use.ts", "dist/post-tool-use.js"],
  ["src/hooks/stop.ts", "dist/stop.js"],
  ["src/hooks/pre-compact.ts", "dist/pre-compact.js"],
];

await Promise.all(
  entries.map(([entryPoints, outfile]) =>
    esbuild.build({
      entryPoints: [entryPoints],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      target: "node20",
      packages: "external",
    }),
  ),
);
