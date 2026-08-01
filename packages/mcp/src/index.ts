/**
 * MCP server entrypoint (Stdio). Use LIGHTDASH_URL and LIGHTDASH_API_KEY.
 * Logging: stderr only (stdout is JSON-RPC).
 *
 * Optional persona via LIGHTDASH_TOOLS_MCP_STDIO_PERSONA (set by bin subcommands).
 */

import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';

import { initAuditLog } from './audit/audit.js';
import { EnvContextProvider } from './auth/providers/env-context-provider.js';
import { getAuditLogPath, warnIgnoredCliGuardrailEnvVars } from './config/runtime.js';
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
      `Invalid LIGHTDASH_TOOLS_MCP_STDIO_PERSONA='${raw}'. Expected semantic-layer, organization-audit, content-reader, or content-developer.`,
    );
  }
  return getPersona(id);
}

async function main(): Promise<void> {
  warnIgnoredCliGuardrailEnvVars();
  initAuditLog(getAuditLogPath());

  const persona = resolveStdioPersona();
  const contextProvider = new EnvContextProvider();
  const server = createLightdashMcpServer(contextProvider, { persona });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Lightdash MCP server (${persona.id}) running on stdio`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
