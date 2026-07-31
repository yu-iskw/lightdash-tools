/**
 * Shared MCP tool registry: short id → register(server, ctx).
 * Wire names are always `ldt__` + id via registerToolSafe.
 */

import {
  registerGetExplore,
  registerGetFieldLineage,
  registerListDimensions,
  registerListExplores,
} from './explores.js';
import { registerGetMetric, registerListMetrics } from './metrics.js';
import { registerGetProject, registerListProjects } from './projects.js';
import { registerCompileQuery } from './query.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type ToolRegistration = {
  register: (server: McpServer, contextProvider: McpContextProvider) => void;
};

export const toolRegistry = {
  compile_query: { register: registerCompileQuery },
  get_explore: { register: registerGetExplore },
  get_field_lineage: { register: registerGetFieldLineage },
  get_metric: { register: registerGetMetric },
  get_project: { register: registerGetProject },
  list_dimensions: { register: registerListDimensions },
  list_explores: { register: registerListExplores },
  list_metrics: { register: registerListMetrics },
  list_projects: { register: registerListProjects },
} as const satisfies Record<string, ToolRegistration>;

export type ToolId = keyof typeof toolRegistry;

/** Register a subset of tools by id (persona allowlist). */
export function registerToolsByIds(
  server: McpServer,
  contextProvider: McpContextProvider,
  ids: readonly ToolId[],
): void {
  for (const id of ids) {
    // eslint-disable-next-line security/detect-object-injection -- ToolId union keys only
    const entry = toolRegistry[id];
    if (!entry) {
      throw new Error(`Unknown MCP tool id: ${String(id)}`);
    }
    entry.register(server, contextProvider);
  }
}
