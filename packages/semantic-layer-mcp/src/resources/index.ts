/**
 * MCP resource registration barrel.
 */

import { registerPlaybookResource } from './playbook.js';

import type { McpServer } from '@modelcontextprotocol/server';

export function registerResources(server: McpServer): void {
  registerPlaybookResource(server);
}
