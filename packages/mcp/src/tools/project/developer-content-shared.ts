/**
 * Shared helpers/constants for content-developer tool registration (ADR-0014).
 */

import { developerErrorResult } from '../../policy/content-developer.js';
import { wrapTool } from '../shared.js';

import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { McpContextProvider } from '../../server/request-context.js';
import type { TextContent, ToolHandler } from '../shared.js';
import type { LightdashClient } from '@lightdash-tools/client';

export const MOVE_CONTENT_TYPES = ['chart', 'dashboard', 'space', 'data_app'] as const;
export const MOVE_CHART_SOURCES = ['dbt_explore', 'sql'] as const;

export function developerContext(scope: ResolvedProjectScope): {
  persona: 'content-developer';
  projectUuid: string;
  projectPinned: boolean;
} {
  return {
    persona: 'content-developer',
    projectUuid: scope.projectUuid,
    projectPinned: scope.projectPinned,
  };
}

/** Wraps `wrapTool` with the standard try/catch -> `developerErrorResult` mapping shared by every tool below. */
export function wrapDeveloperHandler<T>(
  contextProvider: McpContextProvider,
  fn: (client: LightdashClient) => (args: T) => Promise<TextContent>,
): ToolHandler {
  return wrapTool<T>(contextProvider, (client) => {
    const handler = fn(client);
    return async (args: T): Promise<TextContent> => {
      try {
        return await handler(args);
      } catch (err) {
        return developerErrorResult(err);
      }
    };
  });
}
