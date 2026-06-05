import { loadCredentials } from "./auth.ts";
import { applyUserEmail, resolveAuth, type AuthContext } from "./authContext.ts";
import { distillAndStore } from "./distill.ts";
import { bufferToTranscript, type SessionState } from "./sessionStore.ts";
import { readStdinText } from "./stdin.ts";

export interface HookInputBase {
  workspace_roots?: string[];
  user_email?: string;
}

export function hookOk(): void {
  process.stdout.write(JSON.stringify({ continue: true }));
}

export function runHookSafe(label: string, fn: () => Promise<void>): void {
  fn().catch((err) => {
    console.error(`[supermemory] ${label} error:`, err);
    hookOk();
  });
}

export async function readHookInput<T>(): Promise<T> {
  const raw = await readStdinText();
  return JSON.parse(raw) as T;
}

export function resolveHookAuth(input: HookInputBase): AuthContext | null {
  if (!loadCredentials()) return null;
  applyUserEmail(input.user_email);
  const workspaceRoot = input.workspace_roots?.[0] || process.cwd();
  return resolveAuth(workspaceRoot);
}

export async function flushSessionBuffer(
  session: SessionState,
  auth: AuthContext,
): Promise<boolean> {
  if (!session.buffer.length) return false;

  const stored = await distillAndStore(bufferToTranscript(session.buffer), {
    apiKey: auth.apiKey,
    projectTag: auth.projectTag,
    userTag: auth.userTag,
  });
  if (stored) session.buffer = [];
  return stored;
}
