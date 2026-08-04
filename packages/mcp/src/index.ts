/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 *
 * Profile is selected by CLI argv (`lightdash-mcp <profile>` / `stdio <profile>`)
 * and passed into {@link startStdio} — not via env.
 *
 * Uses SDK `serveStdio` so the process speaks 2026-07-28 (and legacy initialize
 * via `legacy: 'serve'`). Hand-wiring `StdioServerTransport` + `connect()` stays
 * on the 2025-era wire only.
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { initAuditLog } from './audit/audit.js';
import { EnvContextProvider } from './auth/providers/env-context-provider.js';
import { assertObsoleteEnvRejected } from './config/obsolete-env.js';
import { getAuditLogPath, warnIgnoredCliGuardrailEnvVars } from './config/runtime.js';
import { validateAvailableProjectsConfig } from './governance/available-projects.js';
import { getProfile } from './profiles/index.js';
import { createLightdashMcpServer } from './server/server.js';

import type { ProfileId } from './profiles/types.js';

/** Start stdio MCP for an explicit profile (CLI-selected). */
export function startStdio(profileId: ProfileId): void {
  try {
    assertObsoleteEnvRejected(process.env);
    warnIgnoredCliGuardrailEnvVars();
    validateAvailableProjectsConfig();
    initAuditLog(getAuditLogPath());

    const profile = getProfile(profileId);
    const contextProvider = new EnvContextProvider();

    serveStdio(() => createLightdashMcpServer(contextProvider, { profile }), {
      legacy: 'serve',
      onerror: (error) => {
        console.error('MCP stdio error:', error);
      },
    });
    console.error(`Lightdash MCP server (${profile.id}) running on stdio`);
  } catch (err) {
    console.error('Fatal:', err);
    process.exit(1);
  }
}
