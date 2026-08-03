/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 *
 * Optional profile via LIGHTDASH_TOOLS_MCP_STDIO_PROFILE (set by bin subcommands).
 *
 * Uses SDK `serveStdio` so the process speaks 2026-07-28 (and legacy initialize
 * via `legacy: 'serve'`). Hand-wiring `StdioServerTransport` + `connect()` stays
 * on the 2025-era wire only.
 */

import { PROFILE_IDS } from '@lightdash-tools/common';
import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { initAuditLog } from './audit/audit.js';
import { EnvContextProvider } from './auth/providers/env-context-provider.js';
import { assertObsoleteEnvRejected } from './config/obsolete-env.js';
import { getAuditLogPath, warnIgnoredCliGuardrailEnvVars } from './config/runtime.js';
import { validateAvailableProjectsConfig } from './governance/available-projects.js';
import { getDefaultProfile, getProfile, parseProfileId } from './profiles/index.js';
import { createLightdashMcpServer } from './server/server.js';

import type { ProfileDefinition } from './profiles/types.js';

function resolveStdioProfile(): ProfileDefinition {
  const raw = process.env.LIGHTDASH_TOOLS_MCP_STDIO_PROFILE;
  if (!raw) {
    return getDefaultProfile();
  }
  const id = parseProfileId(raw);
  if (!id) {
    throw new Error(
      `Invalid LIGHTDASH_TOOLS_MCP_STDIO_PROFILE='${raw}'. Expected one of: ${PROFILE_IDS.join(', ')}.`,
    );
  }
  return getProfile(id);
}

function main(): void {
  assertObsoleteEnvRejected(process.env);
  warnIgnoredCliGuardrailEnvVars();
  validateAvailableProjectsConfig();
  initAuditLog(getAuditLogPath());

  const profile = resolveStdioProfile();
  const contextProvider = new EnvContextProvider();

  serveStdio(() => createLightdashMcpServer(contextProvider, { profile }), {
    legacy: 'serve',
    onerror: (error) => {
      console.error('MCP stdio error:', error);
    },
  });
  console.error(`Lightdash MCP server (${profile.id}) running on stdio`);
}

try {
  main();
} catch (err) {
  console.error('Fatal:', err);
  process.exit(1);
}
