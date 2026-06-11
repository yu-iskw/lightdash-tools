/**
 * MCP prompt registration barrel.
 */

import { registerAiAgentPrompts } from './ai-agents.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpProfile } from '../config.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export { registerAiAgentPrompts } from './ai-agents.js';

export function registerPrompts(
  server: McpServer,
  client: LightdashClient,
  profiles: Set<McpProfile>,
): void {
  registerAiAgentPrompts(server, client, profiles);
}
