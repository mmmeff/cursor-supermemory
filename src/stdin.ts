import { stdin } from "node:process";

/** Read all bytes from hook stdin (fd 0). */
export function readStdinText(): Promise<string> {
  if (stdin.isTTY) return Promise.resolve("");

  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stdin.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stdin.on("error", reject);
    stdin.resume();
  });
}
