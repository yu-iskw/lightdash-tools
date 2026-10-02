/**
 * Shared helpers/constants for content-developer tool registration (ADR-0014).
 */

import { developerErrorResult } from '../../policy/content-developer.js';
import { asPaginated } from '../lib/api-shape.js';
import { wrapToolContextual } from '../shared.js';

import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { TextContent, ToolExecutionContext, ToolHandler } from '../shared.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { ServerContext } from '@modelcontextprotocol/server';

export const MOVE_CONTENT_TYPES = ['chart', 'dashboard', 'data_app'] as const;
export const MOVE_CHART_SOURCES = ['dbt_explore', 'sql'] as const;

/** Resolve a single content summary by exact uuid (project-scoped). */
export async function findContentByUuid(
  client: LightdashClient,
  projectUuid: string,
  uuid: string,
): Promise<Record<string, unknown> | null> {
  const result = await client.v2.content.searchContent({
    projectUuids: [projectUuid],
    uuids: [uuid],
    pageSize: 50,
  });
  const { data } = asPaginated<Record<string, unknown>>(result);
  return data.find((item) => item.uuid === uuid) ?? null;
}

export function developerContext(scope: ResolvedProjectScope): {
  profile: 'content-developer';
  projectUuid: string;
  projectPinned: boolean;
} {
  return {
    profile: 'content-developer',
    projectUuid: scope.projectUuid,
    projectPinned: scope.projectPinned,
  };
}

export type DeveloperHandlerContext = {
  client: LightdashClient;
  serverContext: ServerContext | undefined;
  subject: string;
};

/** Wraps wrapToolContextual with developer error mapping + subject for signed preview tokens. */
export function wrapDeveloperHandler<T>(
  contextProvider: McpContextProvider,
  fn: (ctx: DeveloperHandlerContext) => (args: T) => Promise<TextContent>,
): ToolHandler {
  return wrapToolContextual<T>(contextProvider, (exec: ToolExecutionContext) => {
    const handler = fn({
      client: exec.lightdashClient,
      serverContext: exec.serverContext,
      subject: exec.subject,
    });
    return async (args: T): Promise<TextContent> => {
      try {
        return await handler(args);
      } catch (err) {
        return developerErrorResult(err);
      }
    };
  });
}
