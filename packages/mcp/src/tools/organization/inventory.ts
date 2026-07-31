/**
 * Organization inventory primitive tools.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { emptyCoverage, isPageComplete } from '../lib/contracts.js';
import {
  CREDENTIALS_OMITTED_WARNING,
  emailRedactionWarnings,
  toGroupSummary,
  toOrgMemberSummary,
  toProjectSummary,
} from '../lib/redaction.js';
import { registerOrgAuditTool } from '../lib/register-org-audit.js';
import {
  allowedEmailDomainsField,
  includeEmailField,
  projectUuidField,
} from '../lib/schema-fields.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import { resolveSessionOrganization } from './binding.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerGetOrgProfile(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'get_org_profile',
    {
      title: 'Get organization profile',
      description:
        'Resolve the authenticated organization identity, caller role, and audit visibility',
      inputSchema: {},
    },
    wrapTool(contextProvider, (c) => async () => {
      const session = await resolveSessionOrganization(c);
      const org = await c.v1.organizations.getCurrentOrganization();
      return jsonToolResult({
        organizationUuid: session.organizationUuid,
        name: org.name ?? session.organizationName,
        currentUserUuid: session.currentUserUuid,
        currentUserOrganizationRole: session.currentUserOrganizationRole,
        currentUserRoleUuid: session.currentUserRoleUuid,
        auditVisibility: session.auditVisibility,
        capabilities: [
          'members',
          'groups',
          'projects',
          'roles',
          'content',
          'validation',
          'user_activity',
          'schedulers',
        ],
        coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
      });
    }),
  );
}

export function registerListOrgMembers(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_org_members',
    {
      title: 'List organization members',
      description: 'List organization members with optional search and email redaction',
      inputSchema: {
        search: z.string().optional().describe('Search query'),
        projectUuid: projectUuidField().optional(),
        includeGroups: z.boolean().optional(),
        includeEmail: includeEmailField(),
        allowedEmailDomains: allowedEmailDomainsField(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          search?: string;
          projectUuid?: string;
          includeGroups?: boolean;
          includeEmail?: boolean;
          allowedEmailDomains?: string[];
          page?: number;
          pageSize?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const includeEmail = args.includeEmail === true;
          const result = await c.v1.users.listMembers({
            searchQuery: args.search,
            projectUuid: args.projectUuid,
            includeGroups: args.includeGroups ? 10 : undefined,
            page: args.page,
            pageSize: args.pageSize,
          });
          const data = (result.data ?? []).map((m) =>
            toOrgMemberSummary(m, includeEmail, args.allowedEmailDomains),
          );
          const complete = isPageComplete(
            data.length,
            result.pagination?.totalResults,
            result.pagination?.totalPageCount,
            args.page ?? result.pagination?.page,
          );
          return jsonToolResult({
            data,
            pagination: {
              returned: data.length,
              totalResults: result.pagination?.totalResults,
              complete,
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              complete,
              apiResolutions: [
                {
                  capability: 'organization_members',
                  selectedVersion: 'v1',
                  method: 'GET',
                  pathTemplate: '/api/v1/org/users',
                  reason: 'v2_unavailable',
                },
              ],
            },
            warnings: emailRedactionWarnings(includeEmail),
          });
        },
    ),
  );
}

export function registerGetOrgMember(server: McpServer, contextProvider: McpContextProvider): void {
  registerOrgAuditTool(
    server,
    'get_org_member',
    {
      title: 'Get organization member',
      description: 'Get one organization member by UUID',
      inputSchema: {
        userUuid: z.string().describe('User UUID'),
        includeEmail: includeEmailField(),
        allowedEmailDomains: allowedEmailDomainsField(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          userUuid: string;
          includeEmail?: boolean;
          allowedEmailDomains?: string[];
        }) => {
          const session = await resolveSessionOrganization(c);
          const includeEmail = args.includeEmail === true;
          const m = await c.v1.users.getMemberByUuid(args.userUuid);
          return jsonToolResult({
            ...toOrgMemberSummary(m, includeEmail, args.allowedEmailDomains),
            coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            warnings: emailRedactionWarnings(includeEmail),
          });
        },
    ),
  );
}

export function registerListOrgGroups(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_org_groups',
    {
      title: 'List organization groups',
      description: 'List organization groups with optional bounded member inclusion',
      inputSchema: {
        search: z.string().optional(),
        includeMembers: z.number().int().min(0).max(100).optional(),
        includeEmail: includeEmailField(),
        allowedEmailDomains: allowedEmailDomainsField(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          search?: string;
          includeMembers?: number;
          includeEmail?: boolean;
          allowedEmailDomains?: string[];
          page?: number;
          pageSize?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const includeEmail = args.includeEmail === true;
          const result = await c.v1.groups.listGroups({
            searchQuery: args.search,
            includeMembers: args.includeMembers,
            page: args.page,
            pageSize: args.pageSize,
          });
          const raw = result.data ?? [];
          const data = raw.map((g) => toGroupSummary(g, includeEmail, args.allowedEmailDomains));
          const complete = isPageComplete(
            data.length,
            result.pagination?.totalResults,
            result.pagination?.totalPageCount,
            args.page ?? result.pagination?.page,
          );
          return jsonToolResult({
            data,
            pagination: {
              returned: data.length,
              totalResults: result.pagination?.totalResults,
              complete,
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              complete,
              apiResolutions: [
                {
                  capability: 'organization_groups',
                  selectedVersion: 'v1',
                  method: 'GET',
                  pathTemplate: '/api/v1/org/groups',
                  reason: 'v2_unavailable',
                },
              ],
            },
            warnings: args.includeMembers ? emailRedactionWarnings(includeEmail) : [],
          });
        },
    ),
  );
}

export function registerListOrgProjects(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_org_projects',
    {
      title: 'List organization projects',
      description: 'Inventory organization projects (warehouse type only; no credentials)',
      inputSchema: {
        includePreviewProjects: z.boolean().optional(),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { includePreviewProjects?: boolean }) => {
      const session = await resolveSessionOrganization(c);
      const pinned = getPinnedProjectUuid();
      let projects = await c.v1.projects.listProjects();
      if (pinned) {
        projects = projects.filter((p) => p.projectUuid === pinned);
      }
      if (!args.includePreviewProjects) {
        projects = projects.filter((p) => p.type !== 'PREVIEW');
      }
      const data = projects.map((p) => toProjectSummary(p));
      return jsonToolResult({
        data,
        pagination: { returned: data.length, complete: true },
        coverage: {
          ...emptyCoverage(session.organizationUuid, pinned),
          projectUuids: data.map((p) => p.projectUuid),
          apiResolutions: [
            {
              capability: 'organization_projects',
              selectedVersion: 'v1',
              method: 'GET',
              pathTemplate: '/api/v1/org/projects',
              reason: 'v2_unavailable',
            },
          ],
        },
        warnings: [CREDENTIALS_OMITTED_WARNING],
      });
    }),
  );
}
