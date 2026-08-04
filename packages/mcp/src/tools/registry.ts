/**
 * Register profile-mounted ToolModules (orchestration only).
 */

import { IRRECOVERABLE_TOOL_DENYLIST } from '@lightdash-tools/common';

import type { ToolModule } from './types.js';
import type { McpContextProvider } from '../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type { ToolModule } from './types.js';

const BANNED_MCP_TOOL_IDS = new Set<string>(IRRECOVERABLE_TOOL_DENYLIST);

/** Register profile-mounted tool modules (deterministic order = array order). */
export function registerTools(
  server: McpServer,
  contextProvider: McpContextProvider,
  tools: readonly ToolModule[],
): void {
  for (const tool of tools) {
    if (BANNED_MCP_TOOL_IDS.has(tool.id)) {
      throw new Error(`MCP tool id '${tool.id}' is banned (client-only / irrecoverable)`);
    }
    tool.register(server, contextProvider);
  }
}
