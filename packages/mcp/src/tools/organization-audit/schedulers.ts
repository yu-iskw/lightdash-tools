/**
 * Scheduler inventory tools with destination redaction.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { projectUuidField } from '../schema-fields.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import { asPaginated, asRecord } from './api-shape.js';
import { emptyCoverage, isPageComplete } from './contracts.js';
import { resolveSessionOrganization } from './org-binding.js';
import { normalizeScheduler } from './redaction.js';
import { registerOrgAuditTool } from './register.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerListProjectSchedulers(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_project_schedulers',
    {
      title: 'List project schedulers',
      description:
        'List scheduled deliveries for a project (destinations redacted by default; never executes)',
      inputSchema: {
        projectUuid: projectUuidField(),
        search: z.string().optional(),
        formats: z.string().optional(),
        revealDestinations: z.boolean().optional(),
        allowedEmailDomains: z.array(z.string()).optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().optional(),
        includeLatestRun: z.boolean().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid: string;
          search?: string;
          formats?: string;
          revealDestinations?: boolean;
          allowedEmailDomains?: string[];
          page?: number;
          pageSize?: number;
          includeLatestRun?: boolean;
        }) => {
          const session = await resolveSessionOrganization(c);
          const result = await c.v1.schedulers.listSchedulers(args.projectUuid, {
            searchQuery: args.search,
            formats: args.formats,
            page: args.page,
            pageSize: args.pageSize,
            includeLatestRun: args.includeLatestRun ?? true,
          });
          const { data: rows, pagination } = asPaginated<Record<string, unknown>>(result);
          const reveal = args.revealDestinations === true;
          const data = rows.map((row) => normalizeScheduler(row, reveal, args.allowedEmailDomains));
          const complete = isPageComplete(
            data.length,
            pagination?.totalResults,
            pagination?.totalPageCount,
            args.page ?? pagination?.page,
          );
          return jsonToolResult({
            data,
            pagination: {
              returned: data.length,
              totalResults: pagination?.totalResults,
              complete,
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              projectUuids: [args.projectUuid],
              complete,
              apiResolutions: [
                {
                  capability: 'project_schedulers',
                  selectedVersion: 'v1',
                  method: 'GET',
                  pathTemplate: '/api/v1/schedulers/{projectUuid}/list',
                  reason: 'v2_preferred',
                },
              ],
            },
            warnings: reveal
              ? []
              : [{ code: 'REDACTED', message: 'Scheduler destinations redacted by default' }],
          });
        },
    ),
  );
}

export function registerGetScheduler(server: McpServer, contextProvider: McpContextProvider): void {
  registerOrgAuditTool(
    server,
    'get_scheduler',
    {
      title: 'Get scheduler',
      description: 'Get one scheduler by UUID (destinations redacted by default; never executes)',
      inputSchema: {
        schedulerUuid: z.string(),
        revealDestinations: z.boolean().optional(),
        allowedEmailDomains: z.array(z.string()).optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          schedulerUuid: string;
          revealDestinations?: boolean;
          allowedEmailDomains?: string[];
        }) => {
          const session = await resolveSessionOrganization(c);
          const raw = await c.v1.schedulers.getScheduler(args.schedulerUuid);
          const reveal = args.revealDestinations === true;
          return jsonToolResult({
            ...normalizeScheduler(asRecord(raw), reveal, args.allowedEmailDomains),
            coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            warnings: reveal
              ? []
              : [{ code: 'REDACTED', message: 'Scheduler destinations redacted by default' }],
          });
        },
    ),
  );
}
