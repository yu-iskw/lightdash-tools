/**
 * Roles and project access primitive tools.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import {
  isForbiddenOrNotFound,
  isUnsupportedCapabilityError,
  visibilityFailureReason,
} from '../lib/api-errors.js';
import { emptyCoverage } from '../lib/contracts.js';
import { emailRedactionWarnings, toProjectMemberAccessSummary } from '../lib/redaction.js';
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

export function registerListOrgRoleAssignments(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_org_role_assignments',
    {
      title: 'List organization role assignments',
      description: 'List organization-level role assignments (v2)',
      inputSchema: {
        assigneeType: z.enum(['user', 'group']).optional(),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { assigneeType?: 'group' | 'user' }) => {
      const session = await resolveSessionOrganization(c);
      let data = await c.v2.organizationRoles.listRoleAssignments(session.organizationUuid);
      if (args.assigneeType) {
        data = data.filter((a) => a.assigneeType === args.assigneeType);
      }
      return jsonToolResult({
        data,
        pagination: { returned: data.length, complete: true },
        coverage: {
          ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
          apiResolutions: [
            {
              capability: 'organization_role_assignments',
              selectedVersion: 'v2',
              method: 'GET',
              pathTemplate: '/api/v2/orgs/{orgUuid}/roles/assignments',
              reason: 'v2_preferred',
            },
          ],
        },
        warnings: [],
      });
    }),
  );
}

export function registerListCustomRoles(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_custom_roles',
    {
      title: 'List custom roles',
      description: 'List organization custom and system roles (v2)',
      inputSchema: {
        search: z.string().optional(),
        roleTypeFilter: z.string().optional(),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { search?: string; roleTypeFilter?: string }) => {
      const session = await resolveSessionOrganization(c);
      try {
        let data = await c.v2.organizationRoles.getRoles(session.organizationUuid, {
          roleTypeFilter: args.roleTypeFilter,
        });
        if (args.search) {
          const q = args.search.toLowerCase();
          data = data.filter((r) => r.name.toLowerCase().includes(q));
        }
        return jsonToolResult({
          data: data.map((r) => ({
            roleUuid: r.roleUuid,
            name: r.name,
            description:
              'description' in r ? (r as { description?: string }).description : undefined,
            ownerType: r.ownerType,
            level: r.level,
            scopeCount:
              'scopes' in r && Array.isArray((r as { scopes?: string[] }).scopes)
                ? (r as { scopes: string[] }).scopes.length
                : undefined,
          })),
          pagination: { returned: data.length, complete: true },
          coverage: {
            ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            apiResolutions: [
              {
                capability: 'custom_roles',
                selectedVersion: 'v2',
                method: 'GET',
                pathTemplate: '/api/v2/orgs/{orgUuid}/roles',
                reason: 'v2_preferred',
              },
            ],
          },
          warnings: [],
        });
      } catch (err) {
        if (isForbiddenOrNotFound(err)) {
          return jsonToolResult({
            data: [],
            pagination: { returned: 0, complete: false },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              inaccessibleScopes: [
                {
                  scopeType: 'organization',
                  scopeUuid: session.organizationUuid,
                  reason: visibilityFailureReason(err),
                },
              ],
              complete: false,
            },
            warnings: [
              {
                code: 'PARTIAL_VISIBILITY',
                message: `Custom roles unavailable: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
          });
        }
        if (!isUnsupportedCapabilityError(err)) {
          throw err;
        }
        return jsonToolResult({
          data: [],
          pagination: { returned: 0, complete: false },
          coverage: {
            ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            unsupportedCapabilities: ['custom_roles'],
            complete: false,
          },
          warnings: [
            {
              code: 'UNSUPPORTED_CAPABILITY',
              message: `Custom roles unavailable: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        });
      }
    }),
  );
}

export function registerGetCustomRole(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'get_custom_role',
    {
      title: 'Get custom role',
      description: 'Get a role including scopes (v2)',
      inputSchema: {
        roleUuid: z.string().describe('Role UUID'),
      },
    },
    wrapTool(contextProvider, (c) => async (args: { roleUuid: string }) => {
      const session = await resolveSessionOrganization(c);
      const role = await c.v2.organizationRoles.getRole(session.organizationUuid, args.roleUuid);
      return jsonToolResult({
        ...role,
        coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
      });
    }),
  );
}

export function registerListProjectRoles(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_project_roles',
    {
      title: 'List project role assignments',
      description: 'List v2 project role assignments (users and groups)',
      inputSchema: {
        projectUuid: projectUuidField(),
        assigneeType: z.enum(['user', 'group']).optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) => async (args: { projectUuid: string; assigneeType?: 'group' | 'user' }) => {
        const session = await resolveSessionOrganization(c);
        let data = await c.v2.projectRoleAssignments.listAssignments(args.projectUuid);
        if (args.assigneeType) {
          data = data.filter((a) => a.assigneeType === args.assigneeType);
        }
        return jsonToolResult({
          data,
          pagination: { returned: data.length, complete: true },
          coverage: {
            ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            projectUuids: [args.projectUuid],
            apiResolutions: [
              {
                capability: 'project_role_assignments',
                selectedVersion: 'v2',
                method: 'GET',
                pathTemplate: '/api/v2/projects/{projectId}/roles/assignments',
                reason: 'v2_preferred',
              },
            ],
          },
          warnings: [
            {
              code: 'INCOMPLETE_EFFECTIVE_ACCESS',
              message:
                'Project role assignments alone are not complete effective access; include org roles and space access',
            },
          ],
        });
      },
    ),
  );
}

export function registerListProjectDirectAccess(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_project_direct_access',
    {
      title: 'List project direct access',
      description:
        'List explicitly granted project users only (not complete effective access; org-wide access omitted). Emails redacted by default.',
      inputSchema: {
        projectUuid: projectUuidField(),
        includeEmail: includeEmailField(),
        allowedEmailDomains: allowedEmailDomainsField(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuid: string;
          includeEmail?: boolean;
          allowedEmailDomains?: string[];
        }) => {
          const session = await resolveSessionOrganization(c);
          const includeEmail = args.includeEmail === true;
          const raw = await c.v1.projectAccess.listProjectAccess(args.projectUuid);
          const data = raw.map((m) =>
            toProjectMemberAccessSummary(m, includeEmail, args.allowedEmailDomains),
          );
          return jsonToolResult({
            data,
            accessSemantics: 'direct_only',
            effectiveAccessComplete: false,
            pagination: { returned: data.length, complete: true },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              projectUuids: [args.projectUuid],
              apiResolutions: [
                {
                  capability: 'project_direct_access',
                  selectedVersion: 'v1',
                  method: 'GET',
                  pathTemplate: '/api/v1/projects/{projectUuid}/access',
                  reason: 'v2_incomplete',
                },
              ],
              complete: false,
            },
            warnings: [
              {
                code: 'INCOMPLETE_EFFECTIVE_ACCESS',
                message:
                  'This endpoint lists explicit grants only; other users may have access via organization membership',
              },
              ...emailRedactionWarnings(includeEmail),
            ],
          });
        },
    ),
  );
}
