import {
  getAgentCliStatus,
  installAgentCli,
  runAgentLogin,
} from "./agentCli.ts";
import { confirmDefaultYes } from "./prompt.ts";

const MANUAL_INSTALL_HINT =
  process.platform === "win32"
    ? "Install manually: irm 'https://cursor.com/install?win32=true' | iex"
    : "Install manually: curl https://cursor.com/install -fsS | bash";

const INSTALL_PROMPT =
  process.platform === "win32"
    ? "Install Cursor Agent CLI now? (irm 'https://cursor.com/install?win32=true' | iex)"
    : "Install Cursor Agent CLI now? (curl https://cursor.com/install -fsS | bash)";

export type AgentCliSetupResult = { ok: boolean; lines: string[] };

export async function ensureAgentCliReady(): Promise<AgentCliSetupResult> {
  const lines: string[] = [];
  let status = await getAgentCliStatus();

  if (!status.available) {
    lines.push(
      "Cursor Agent CLI not found — automatic distilled capture will be disabled until it is installed.",
    );

    if (await confirmDefaultYes(INSTALL_PROMPT)) {
      lines.push("Installing Cursor Agent CLI...");
      if (await installAgentCli()) {
        lines.push("Cursor Agent CLI installed.");
        status = await getAgentCliStatus();
      } else {
        lines.push(`Cursor Agent CLI installation failed. ${MANUAL_INSTALL_HINT}`);
        return { ok: false, lines };
      }
    } else {
      lines.push(`Skipped. ${MANUAL_INSTALL_HINT}`);
      return { ok: false, lines };
    }
  }

  if (!status.available) {
    lines.push(`Cursor Agent CLI still not found. ${MANUAL_INSTALL_HINT}`);
    return { ok: false, lines };
  }

  if (!status.authenticated) {
    lines.push(
      "Cursor Agent CLI is not authenticated — automatic distilled capture will be disabled until you log in.",
    );

    if (await confirmDefaultYes("Authenticate Cursor Agent CLI now? (opens browser)")) {
      lines.push("Running agent login...");
      if (await runAgentLogin()) {
        status = await getAgentCliStatus();
        if (status.authenticated) {
          lines.push(
            `Cursor Agent CLI authenticated${status.email ? ` as ${status.email}` : ""}.`,
          );
        } else {
          lines.push("Cursor Agent CLI login did not complete successfully. Run `agent login` manually.");
          return { ok: false, lines };
        }
      } else {
        lines.push("Cursor Agent CLI login failed. Run `agent login` manually.");
        return { ok: false, lines };
      }
    } else {
      lines.push("Skipped. Run `agent login` when ready.");
      return { ok: false, lines };
    }
  } else {
    lines.push(`Cursor Agent CLI ready${status.email ? ` (${status.email})` : ""}.`);
  }

  return { ok: true, lines };
}
