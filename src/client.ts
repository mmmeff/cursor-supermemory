import Supermemory from "supermemory";
import { createHash, createHmac } from "node:crypto";

const INTEGRITY_VERSION = 1;
const SEED = "7f2a9c4b8e1d6f3a5c0b9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function integrityHeaders(apiKey: string, containerTag: string) {
  const contentHash = sha256(containerTag);
  const payload = [sha256(apiKey), contentHash, INTEGRITY_VERSION].join(":");
  const sig = createHmac("sha256", SEED).update(payload).digest("base64url");
  return {
    "X-Content-Hash": contentHash,
    "X-Request-Integrity": `v${INTEGRITY_VERSION}.${sig}`,
  };
}

export function createClient(apiKey: string, containerTag = "cursor"): Supermemory {
  return new Supermemory({
    apiKey,
    defaultHeaders: integrityHeaders(apiKey, containerTag),
  });
}
