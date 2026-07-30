/**
 * MCP resource registration barrel.
 */

import { registerAiAgentResources } from './ai-agents.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerResources(server: McpServer, contextProvider: McpContextProvider): void {
  registerAiAgentResources(server, contextProvider);
}
