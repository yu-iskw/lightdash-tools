/**
 * Scheduler inventory tools with destination redaction.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { asPaginated, asRecord } from '../lib/api-shape.js';
import { emptyCoverage, isPageComplete } from '../lib/contracts.js';
import { destinationRedactionWarnings, normalizeScheduler } from '../lib/redaction.js';
import { registerOrgAuditTool } from '../lib/register-org-audit.js';
import { allowedEmailDomainsField, projectUuidField } from '../lib/schema-fields.js';
import { resolveSessionOrganization } from '../organization/binding.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

const SCHEDULER_MEMBERSHIP_PAGE_BUDGET = 10;

/** Confirm schedulerUuid appears in the project's scheduler list (when response omits projectUuid). */
async function schedulerBelongsToProject(
  client: LightdashClient,
  projectUuid: string,
  schedulerUuid: string,
): Promise<boolean> {
  for (let page = 1; page <= SCHEDULER_MEMBERSHIP_PAGE_BUDGET; page += 1) {
    const result = await client.v1.schedulers.listSchedulers(projectUuid, {
      page,
      pageSize: 100,
    });
    const { data, pagination } = asPaginated<Record<string, unknown>>(result);
    if (data.some((row) => String(row.schedulerUuid ?? row.uuid ?? '') === schedulerUuid)) {
      return true;
    }
    if (isPageComplete(data.length, pagination?.totalResults, pagination?.totalPageCount, page)) {
      return false;
    }
  }
  return false;
}

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
        allowedEmailDomains: allowedEmailDomainsField(),
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
            warnings: destinationRedactionWarnings(reveal),
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
      description:
        'Get one scheduler by UUID within a project (destinations redacted by default; never executes)',
      inputSchema: {
        projectUuid: projectUuidField(),
        schedulerUuid: z.string(),
        revealDestinations: z.boolean().optional(),
        allowedEmailDomains: allowedEmailDomainsField(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid: string;
          schedulerUuid: string;
          revealDestinations?: boolean;
          allowedEmailDomains?: string[];
        }) => {
          const session = await resolveSessionOrganization(c);
          const pinned = getPinnedProjectUuid();
          const raw = asRecord(await c.v1.schedulers.getScheduler(args.schedulerUuid));
          const schedulerProject =
            typeof raw.projectUuid === 'string' ? raw.projectUuid : undefined;
          if (schedulerProject) {
            if (schedulerProject !== args.projectUuid) {
              return jsonToolResult({
                error: `Scheduler ${args.schedulerUuid} belongs to project ${schedulerProject}, not ${args.projectUuid}`,
                isError: true,
              });
            }
          } else if (!(await schedulerBelongsToProject(c, args.projectUuid, args.schedulerUuid))) {
            return jsonToolResult({
              error: `Scheduler ${args.schedulerUuid} was not found in project ${args.projectUuid}`,
              isError: true,
            });
          }
          const reveal = args.revealDestinations === true;
          return jsonToolResult({
            ...normalizeScheduler(raw, reveal, args.allowedEmailDomains),
            coverage: {
              ...emptyCoverage(session.organizationUuid, pinned),
              projectUuids: [args.projectUuid],
            },
            warnings: destinationRedactionWarnings(reveal),
          });
        },
    ),
  );
}
