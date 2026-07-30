/**
 * Tool registration barrel.
 *
 * Package-is-allowlist: only handlers registered here appear in tools/list.
 * Future list/set project tools should skip registration when
 * `governance.pinnedProjectUuid` is set from HTTP `X-Lightdash-Project`
 * (official Lightdash MCP pin behavior).
 */

import { registerExploresTools } from './explores.js';
import { registerMetricsTools } from './metrics.js';
import { registerProjectTools } from './projects.js';
import { registerQueryTools } from './query.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerProjectTools(server, contextProvider);
  registerExploresTools(server, contextProvider);
  registerMetricsTools(server, contextProvider);
  registerQueryTools(server, contextProvider);
}
