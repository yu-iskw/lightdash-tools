/**
 * MCP prompt registration barrel.
 */

import { registerAiAgentPrompts } from './ai-agents.js';

import type { McpProfile } from '../config.js';
import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerPrompts(
  server: McpServer,
  contextProvider: McpContextProvider,
  profiles: Set<McpProfile>,
): void {
  registerAiAgentPrompts(server, contextProvider, profiles);
}
