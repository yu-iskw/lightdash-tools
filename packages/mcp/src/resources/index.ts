/**
 * MCP resource registration barrel.
 */

import { registerAiAgentResources } from './ai-agents.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export { registerAiAgentResources, EVALUATION_RUN_RESULTS_URI_TEMPLATE } from './ai-agents.js';

export function registerResources(server: McpServer, client: LightdashClient): void {
  registerAiAgentResources(server, client);
}
