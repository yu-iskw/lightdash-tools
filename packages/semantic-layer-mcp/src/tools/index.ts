/**
 * Tool registration barrel.
 *
 * Package-is-allowlist: only handlers registered here appear in tools/list.
 * Future list/set project tools should skip registration when
 * `governance.pinnedProjectUuid` is set (official Lightdash MCP pin behavior).
 */

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerTools(_server: McpServer, _contextProvider: McpContextProvider): void {
  // Fixed tool handlers land here.
}
