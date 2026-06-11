/**
 * MCP tools: AI agents (admin) — agents, threads, and organization settings.
 */

import { z } from 'zod';

import {
  wrapTool,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
} from '../shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAdminAiAgentTools(server: McpServer, client: LightdashClient): void {
  // ─── Admin: agents ───────────────────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_admin_agents',
    {
      title: 'List AI agents (admin)',
      description: 'List all AI agents across the organization (admin view)',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async () => {
      const result = await c.v1.aiAgents.listAdminAgents();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  // ─── Admin: threads ──────────────────────────────────────────────────────────

  registerToolSafe(
    server,
    'list_admin_agent_threads',
    {
      title: 'List AI agent threads (admin)',
      description:
        'List AI agent conversation threads across the organization with optional filters',
      inputSchema: {
        page: z.number().optional().describe('Page number (1-based)'),
        pageSize: z.number().optional().describe('Number of results per page'),
        agentUuids: z.array(z.string()).optional().describe('Filter by agent UUIDs'),
        projectUuids: z.array(z.string()).optional().describe('Filter by project UUIDs'),
        humanScore: z
          .number()
          .optional()
          .describe('Filter by human score: -1 (negative), 0 (neutral), 1 (positive)'),
        dateFrom: z.string().optional().describe('Start date filter (YYYY-MM-DD)'),
        dateTo: z.string().optional().describe('End date filter (YYYY-MM-DD)'),
        sortField: z.enum(['createdAt', 'title']).optional().describe('Sort field'),
        sortDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      client,
      (c) =>
        async (params: {
          page?: number;
          pageSize?: number;
          agentUuids?: string[];
          projectUuids?: string[];
          humanScore?: number;
          dateFrom?: string;
          dateTo?: string;
          sortField?: 'createdAt' | 'title';
          sortDirection?: 'asc' | 'desc';
        }) => {
          const result = await c.v1.aiAgents.getAdminThreads(params);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        },
    ),
  );

  // ─── Admin: settings ─────────────────────────────────────────────────────────

  registerToolSafe(
    server,
    'get_ai_organization_settings',
    {
      title: 'Get AI organization settings',
      description: 'Get the AI settings for the current organization (admin)',
      inputSchema: {},
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async () => {
      const result = await c.v1.aiAgents.getAiOrganizationSettings();
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );

  registerToolSafe(
    server,
    'update_ai_organization_settings',
    {
      title: 'Update AI organization settings',
      description: 'Update the AI settings for the current organization (admin)',
      inputSchema: {
        aiAgentsVisible: z
          .boolean()
          .optional()
          .describe('Whether AI agents feature is visible to users'),
      },
      annotations: WRITE_IDEMPOTENT,
    },
    wrapTool(client, (c) => async (params: { aiAgentsVisible?: boolean }) => {
      const result = await c.v1.aiAgents.updateAiOrganizationSettings(
        params as Parameters<typeof c.v1.aiAgents.updateAiOrganizationSettings>[0],
      );
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    }),
  );
}
