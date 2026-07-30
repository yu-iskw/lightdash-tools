/**
 * MCP prompt registration barrel.
 */

import { registerSemanticLayerPrompts } from './semantic-layer.js';

import type { McpServer } from '@modelcontextprotocol/server';

export function registerPrompts(server: McpServer): void {
  registerSemanticLayerPrompts(server);
}
