/**
 * MCP tools: projects (list, get).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LightdashClient } from '@lightdash-tools/client';
import { z } from 'zod';
import { wrapTool, registerToolSafe, READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from './shared.js';

export function registerProjectTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'list_projects',
    {
      title: 'List projects',
      description: 'List all projects in the current organization',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, () => async () => {
      const projects = await client.v1.projects.listProjects();
      return { content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_project',
    {
      title: 'Get project',
      description: 'Get a project by UUID',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const project = await c.v1.projects.getProject(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'validate_project',
    {
      title: 'Validate project',
      description: 'Trigger a validation job for a project and return the job ID',
      inputSchema: { projectUuid: z.string().describe('Project UUID') },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(client, (c) => async ({ projectUuid }: { projectUuid: string }) => {
      const result = await c.v1.validation.validateProject(projectUuid);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );
  registerToolSafe(
    server,
    'get_validation_results',
    {
      title: 'Get validation results',
      description: 'Get validation results for a project (v2 API, paginated)',
      inputSchema: {
        projectUuid: z.string().describe('Project UUID'),
        validationId: z.number().optional().describe('Optional validation result ID (number)'),
        page: z.number().optional().describe('Page number (1-indexed)'),
        pageSize: z.number().optional().describe('Results per page'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          projectUuid,
          validationId,
          page,
          pageSize,
        }: {
          projectUuid: string;
          validationId?: number;
          page?: number;
          pageSize?: number;
        }) => {
          if (validationId !== undefined) {
            // Get specific validation result by ID
            const result = await c.v2.validation.getValidationResult(projectUuid, validationId);
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          } else {
            // List validation results (first page by default)
            const result = await c.v2.validation.listValidationResults(projectUuid, {
              page,
              pageSize,
            });
            return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
          }
        },
    ),
  );
}
