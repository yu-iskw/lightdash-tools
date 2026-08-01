/**
 * Content-reader space navigation tools.
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { METADATA_SAFETY, registerContentReaderTool } from '../../policy/content-reader.js';
import { contentReaderEnvelope } from '../../policy/envelope.js';
import { asRecord } from '../lib/api-shape.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

function spaceSummary(space: Record<string, unknown>) {
  return {
    uuid: space.uuid,
    slug: space.slug,
    name: space.name,
    parentSpaceUuid: space.parentSpaceUuid,
    path: space.path,
    childSpaceCount: Array.isArray(space.childSpaces) ? space.childSpaces.length : undefined,
    dashboardCount: Array.isArray(space.dashboards) ? space.dashboards.length : undefined,
    chartCount: Array.isArray(space.queries) ? space.queries.length : undefined,
  };
}

export function registerListSpaces(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'list_spaces',
    {
      title: 'List spaces',
      description: 'Browse project space hierarchy (access booleans only; no membership lists)',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        parentSpaceUuid: z.string().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) => async (args: { projectUuid?: string; parentSpaceUuid?: string }) => {
        try {
          const scope = resolveProjectScope({ projectUuid: args.projectUuid });
          const spaces = await c.v1.spaces.listSpacesInProject(scope.projectUuid);
          const items = spaces
            .map((s) => spaceSummary(asRecord(s)))
            .filter((s) =>
              args.parentSpaceUuid
                ? s.parentSpaceUuid === args.parentSpaceUuid
                : s.parentSpaceUuid === undefined || s.parentSpaceUuid === null,
            );
          return jsonToolResult(
            contentReaderEnvelope(
              { spaces: items },
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

export function registerGetSpace(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentReaderTool(
    server,
    'get_space',
    {
      title: 'Get space',
      description: 'Retrieve one space with breadcrumbs and immediate content summaries',
      safety: METADATA_SAFETY,
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        spaceUuid: z.string(),
        includeChildren: z.boolean().optional(),
        includeContent: z.boolean().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid?: string;
          spaceUuid: string;
          includeChildren?: boolean;
          includeContent?: boolean;
        }) => {
          try {
            const scope = resolveProjectScope({ projectUuid: args.projectUuid });
            const space = asRecord(await c.v1.spaces.getSpace(scope.projectUuid, args.spaceUuid));
            const childSpaces =
              args.includeChildren === false
                ? []
                : (Array.isArray(space.childSpaces) ? space.childSpaces : []).map((s) =>
                    spaceSummary(asRecord(s)),
                  );
            const dashboards =
              args.includeContent === false
                ? []
                : (Array.isArray(space.dashboards) ? space.dashboards : []).map((d) => {
                    const row = asRecord(d);
                    return {
                      contentType: 'dashboard' as const,
                      uuid: row.uuid,
                      name: row.name,
                      slug: row.slug,
                    };
                  });
            const charts =
              args.includeContent === false
                ? []
                : (Array.isArray(space.queries) ? space.queries : []).map((q) => {
                    const row = asRecord(q);
                    return {
                      contentType: 'chart' as const,
                      uuid: row.uuid,
                      name: row.name,
                      slug: row.slug,
                    };
                  });
            return jsonToolResult(
              contentReaderEnvelope(
                {
                  ...spaceSummary(space),
                  description: space.description,
                  breadcrumbs: Array.isArray(space.path) ? space.path : [],
                  childSpaces,
                  dashboards,
                  charts,
                  truncated: false,
                },
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
