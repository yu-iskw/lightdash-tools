import { initAuditLog } from '@lightdash-tools/common';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command } from 'commander';

import { EnvContextProvider } from './auth/env-context-provider.js';
import { addGuardrailOptions, applyGuardrailOptions } from './cli-guardrails.js';
import { getAuditLogPath, getClient } from './config.js';
import { createGenericLightdashMcpServer, createLightdashMcpServer } from './server.js';

import type { McpAuthMode } from './auth/auth-mode.js';
import type { RegisterCapabilitiesOptions } from './capabilities.js';
import type { McpContextProvider, LightdashMcpRequestContext } from './request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type { LightdashMcpServerOptions } from './server.js';

export { addGuardrailOptions, applyGuardrailOptions };

export function createMcpContextProvider(options?: {
  mode?: McpAuthMode;
  client?: LightdashClient;
}): McpContextProvider {
  return new EnvContextProvider({
    mode: options?.mode,
    client: options?.client ?? getClient(),
  });
}

export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function runStdioMcpServer(
  createServer: (contextProvider: McpContextProvider) => McpServer,
): Promise<void> {
  initAuditLog(getAuditLogPath());
  const contextProvider = createMcpContextProvider();
  const server = createServer(contextProvider);
  await connectStdio(server);
}

/** Stdio entrypoint for persona bins with the same guardrail CLI flags as `lightdash-mcp`. */
export function runPersonaStdioBin(
  programName: string,
  createServer: (contextProvider: McpContextProvider) => McpServer,
): void {
  const program = new Command();
  program.name(programName);
  addGuardrailOptions(program);
  program.action((options) => {
    applyGuardrailOptions(options);
    void runStdioMcpServer(createServer).catch((err: unknown) => {
      console.error('Fatal:', err);
      process.exit(1);
    });
  });
  program.parse(process.argv);
}

export type { LightdashMcpRequestContext, McpContextProvider, RegisterCapabilitiesOptions };

export { createLightdashMcpServer, createGenericLightdashMcpServer, getAuditLogPath };

export * from './personas/agent-viewer.js';
export * from './personas/agent-developer.js';
