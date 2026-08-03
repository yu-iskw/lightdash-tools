/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 *
 * Optional persona via LIGHTDASH_TOOLS_MCP_STDIO_PERSONA (set by bin subcommands).
 *
 * Uses SDK `serveStdio` so the process speaks 2026-07-28 (and legacy initialize
 * via `legacy: 'serve'`). Hand-wiring `StdioServerTransport` + `connect()` stays
 * on the 2025-era wire only.
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { initAuditLog } from './audit/audit.js';
import { EnvContextProvider } from './auth/providers/env-context-provider.js';
import { getAuditLogPath, warnIgnoredCliGuardrailEnvVars } from './config/runtime.js';
import { validateAvailableProjectsConfig } from './governance/available-projects.js';
import { getDefaultPersona, getPersona, parsePersonaId } from './personas/index.js';
import { createLightdashMcpServer } from './server/server.js';

import type { PersonaDefinition } from './personas/types.js';

function resolveStdioPersona(): PersonaDefinition {
  const raw = process.env.LIGHTDASH_TOOLS_MCP_STDIO_PERSONA;
  if (!raw) {
    return getDefaultPersona();
  }
  const id = parsePersonaId(raw);
  if (!id) {
    throw new Error(
      `Invalid LIGHTDASH_TOOLS_MCP_STDIO_PERSONA='${raw}'. Expected semantic-layer, organization-audit, content-reader, content-developer, content-governance, or ai-agent-ops.`,
    );
  }
  return getPersona(id);
}

function main(): void {
  warnIgnoredCliGuardrailEnvVars();
  validateAvailableProjectsConfig();
  initAuditLog(getAuditLogPath());

  const persona = resolveStdioPersona();
  const contextProvider = new EnvContextProvider();

  serveStdio(() => createLightdashMcpServer(contextProvider, { persona }), {
    legacy: 'serve',
    onerror: (error) => {
      console.error('MCP stdio error:', error);
    },
  });
  console.error(`Lightdash MCP server (${persona.id}) running on stdio`);
}

try {
  main();
} catch (err) {
  console.error('Fatal:', err);
  process.exit(1);
}
