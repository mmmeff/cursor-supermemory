#!/usr/bin/env node
import { startMcpServer } from "./mcp-server.ts";
import {
  loadCredentials,
  startAuthFlow,
  clearCredentials,
} from "./auth.ts";
import { installPlugin, uninstallPlugin, isPluginInstalled } from "./cursorInstall.ts";
import { confirmDefaultYes } from "./prompt.ts";
import { getAgentCliStatus } from "./agentCli.ts";
import { ensureAgentCliReady } from "./agentCliSetup.ts";

const command = process.argv[2];

function reportInstallResult(result: { ok: boolean; message: string }): void {
  if (result.ok) console.log(result.message);
  else {
    console.error(result.message);
    process.exit(1);
  }
}

function reportAgentCliSetup(result: { ok: boolean; lines: string[] }): void {
  if (result.lines.length > 0) console.log(result.lines.join("\n"));
}

switch (command) {
  case "mcp":
    await startMcpServer();
    break;

  case "login": {
    const existing = loadCredentials();
    if (existing) {
      console.log("Already authenticated. Use `logout` first to re-authenticate.");
      process.exit(0);
    }
    console.log("Opening browser to authenticate...");
    const result = await startAuthFlow();
    if (result.success) {
      console.log("Authenticated successfully.");
      if (await confirmDefaultYes("Install Supermemory into Cursor (MCP, rules, hooks)?")) {
        reportInstallResult(installPlugin());
        reportAgentCliSetup(await ensureAgentCliReady());
      }
    } else {
      console.error(`Authentication failed: ${result.error}`);
      process.exit(1);
    }
    break;
  }

  case "logout": {
    const removed = clearCredentials();
    console.log(removed ? "Logged out." : "No credentials found.");
    break;
  }

  case "install": {
    reportInstallResult(installPlugin());
    reportAgentCliSetup(await ensureAgentCliReady());
    break;
  }

  case "uninstall": {
    reportInstallResult(uninstallPlugin());
    break;
  }

  case "status": {
    const creds = loadCredentials();
    if (creds) {
      console.log(`Authenticated since ${creds.createdAt}`);
      console.log(`API key: ${creds.apiKey.slice(0, 6)}...${creds.apiKey.slice(-4)}`);
    } else {
      console.log("Not authenticated. Run `cursor-supermemory login` to connect.");
    }
    console.log(
      isPluginInstalled()
        ? "Cursor plugin: installed"
        : "Cursor plugin: not installed (run `install`)",
    );

    const agentStatus = await getAgentCliStatus();
    if (!agentStatus.available) {
      console.log("Cursor Agent CLI: not installed (automatic capture disabled)");
    } else if (agentStatus.authenticated) {
      console.log(
        `Cursor Agent CLI: authenticated${agentStatus.email ? ` as ${agentStatus.email}` : ""}`,
      );
    } else {
      console.log("Cursor Agent CLI: installed but not authenticated (run `agent login`)");
    }
    break;
  }

  default:
    console.log(`cursor-supermemory — Persistent AI memory for Cursor

Commands:
  mcp        Start the MCP server (stdio)
  login      Authenticate with Supermemory
  install    Install MCP, rules, hooks into ~/.cursor
  uninstall  Remove plugin from ~/.cursor
  logout     Remove stored credentials
  status     Show authentication status`);
    if (command) process.exit(1);
}
