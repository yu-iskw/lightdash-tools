/**
 * Organization inventory primitive tools.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { projectUuidField } from '../schema-fields.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import { emptyCoverage, isPageComplete } from './contracts.js';
import { resolveSessionOrganization } from './org-binding.js';
import { maybeRedactEmail } from './redaction.js';
import { registerOrgAuditTool } from './register.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

function redactGroupMembers(
  group: Record<string, unknown>,
  includeEmail: boolean,
): Record<string, unknown> {
  const members = Array.isArray(group.members) ? group.members : undefined;
  if (!members) return group;
  return {
    ...group,
    members: members.map((m) => {
      if (!m || typeof m !== 'object') return m;
      const member = m as Record<string, unknown>;
      return {
        userUuid: member.userUuid,
        firstName: member.firstName,
        lastName: member.lastName,
        email: maybeRedactEmail(
          typeof member.email === 'string' ? member.email : undefined,
          includeEmail,
        ),
      };
    }),
  };
}

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
        includeEmail: z
          .boolean()
          .optional()
          .describe('Return full emails when true (default false)'),
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
          const data = (result.data ?? []).map((m) => ({
            userUuid: m.userUuid,
            organizationUuid: m.organizationUuid,
            firstName: m.firstName,
            lastName: m.lastName,
            email: maybeRedactEmail(m.email, includeEmail),
            isActive: m.isActive,
            isInviteExpired: m.isInviteExpired,
            role: m.role,
            roleUuid: m.roleUuid,
          }));
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
            warnings: includeEmail
              ? []
              : [
                  {
                    code: 'REDACTED',
                    message: 'Email addresses redacted; pass includeEmail=true to reveal',
                  },
                ],
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
        includeEmail: z.boolean().optional(),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { userUuid: string; includeEmail?: boolean }) => {
      const session = await resolveSessionOrganization(c);
      const m = await c.v1.users.getMemberByUuid(args.userUuid);
      return jsonToolResult({
        userUuid: m.userUuid,
        organizationUuid: m.organizationUuid,
        firstName: m.firstName,
        lastName: m.lastName,
        email: maybeRedactEmail(m.email, args.includeEmail === true),
        isActive: m.isActive,
        isInviteExpired: m.isInviteExpired,
        role: m.role,
        roleUuid: m.roleUuid,
        coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
      });
    }),
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
        includeEmail: z
          .boolean()
          .optional()
          .describe('Return full member emails when true (default false)'),
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
          const raw = (result.data ?? []) as unknown as Array<Record<string, unknown>>;
          const data = raw.map((g) => redactGroupMembers(g, includeEmail));
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
            warnings:
              args.includeMembers && !includeEmail
                ? [
                    {
                      code: 'REDACTED' as const,
                      message: 'Group member emails redacted; pass includeEmail=true to reveal',
                    },
                  ]
                : [],
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
      const data = projects.map((p) => ({
        projectUuid: p.projectUuid,
        name: p.name,
        type: p.type,
        upstreamProjectUuid: p.upstreamProjectUuid,
        createdByUserUuid: p.createdByUserUuid,
        createdAt: p.createdAt,
        warehouseType: p.warehouseType,
      }));
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
        warnings: [],
      });
    }),
  );
}
