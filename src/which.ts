import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

/** Resolve an executable name on PATH (POSIX and Windows). */
export function whichOnPath(command: string): string | null {
  const pathEnv = process.env.PATH ?? process.env.Path;
  if (!pathEnv) return null;

  const extensions =
    process.platform === "win32"
      ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").map((e) => e.toLowerCase())
      : [""];

  for (const dir of pathEnv.split(delimiter)) {
    for (const ext of extensions) {
      const candidate = join(dir, command + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}
