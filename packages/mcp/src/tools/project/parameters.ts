/**
 * Content-reader project parameter tools.
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { METADATA_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { asPaginated, asRecord } from '../lib/api-shape.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListProjectParameters(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'list_project_parameters',
    {
      title: 'List project parameters',
      description: 'List project parameter definitions',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        search: z.string().optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          search?: string;
          page?: number;
          pageSize?: number;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const result = await c.v2.parameters.listParameters(scope.projectUuid, {
              search: args.search,
              page: args.page,
              pageSize: args.pageSize ?? 25,
            });
            const { data, pagination } = asPaginated<Record<string, unknown>>(result);
            return jsonToolResult(
              contentReaderEnvelope(
                { parameters: data, pagination },
                { projectUuid: scope.projectUuid, projectPinned: scope.projectPinned },
              ),
            );
          } catch (err) {
            return projectScopeErrorResult(err);
          }
        },
    ),
  );
}

export function registerGetProjectParameters(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentReaderTool(
    server,
    'get_project_parameters',
    {
      title: 'Get project parameters',
      description: 'Resolve project parameter definitions/values by name',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        names: z.array(z.string()).min(1),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { projectUuid?: string; names: string[] }) => {
      try {
        const scope = resolveProjectScope({ projectUuid: args.projectUuid });
        const values = asRecord(await c.v2.parameters.getParameters(scope.projectUuid, args.names));
        const unresolvedNames = args.names.filter((name) => !(name in values));
        return jsonToolResult(
          contentReaderEnvelope(
            { values, unresolvedNames },
            { projectUuid: scope.projectUuid, projectPinned: scope.projectPinned },
          ),
        );
      } catch (err) {
        return projectScopeErrorResult(err);
      }
    }),
  );
}
