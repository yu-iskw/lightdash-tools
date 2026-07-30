/**
 * MCP capability registration: tools, prompts, resources (always on).
 */

import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';

import type { McpContextProvider } from './request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerCapabilities(server: McpServer, contextProvider: McpContextProvider): void {
  registerTools(server, contextProvider);
  registerPrompts(server);
  registerResources(server);
}
