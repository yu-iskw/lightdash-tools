/**
 * Space access and effective-access composition tools.
 */

/* eslint-disable max-params, sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity --
 * Access composition intentionally branches on principal/resource/path variants.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../governance/project-pin.js';
import { isForbiddenOrNotFound, visibilityFailureReason } from '../lib/api-errors.js';
import { mapWithConcurrency } from '../lib/concurrency.js';
import { emptyCoverage } from '../lib/contracts.js';
import { registerOrgAuditTool } from '../lib/register-org-audit.js';
import { projectUuidField } from '../lib/schema-fields.js';
import { resolveSessionOrganization } from '../organization/binding.js';
import { jsonToolResult, wrapTool } from '../shared.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type { AuditCoverage, AuditWarning } from '../lib/contracts.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

const SPACE_FETCH_CONCURRENCY = 5;
const MAX_SPACES_PER_PROJECT = 100;

export type SpaceAccessRow = {
  spaceUuid: string;
  spaceName?: string;
  principalType: 'group' | 'user';
  principalUuid?: string;
  role?: string;
  hasDirectAccess?: boolean;
  inheritedFrom?: string;
  inheritedRole?: string;
};

async function loadSpaceAccess(
  client: LightdashClient,
  projectUuid: string,
  spaceUuid?: string,
  includeInherited = true,
): Promise<{
  data: SpaceAccessRow[];
  warnings: AuditWarning[];
  inaccessibleScopes: AuditCoverage['inaccessibleScopes'];
  truncated: boolean;
}> {
  const warnings: AuditWarning[] = [];
  const inaccessibleScopes: AuditCoverage['inaccessibleScopes'] = [];
  let truncated = false;

  let spaceList: Array<{
    uuid: string;
    name?: string;
    access?: unknown;
    groupsAccess?: unknown;
    inheritParentPermissions?: boolean;
    inheritsFromOrgOrProject?: boolean;
    userAccess?: unknown;
  }> = [];

  try {
    if (spaceUuid) {
      spaceList = [await client.v1.spaces.getSpace(projectUuid, spaceUuid)];
    } else {
      const summaries = await client.v1.spaces.listSpacesInProject(projectUuid);
      if (summaries.length > MAX_SPACES_PER_PROJECT) {
        truncated = true;
        warnings.push({
          code: 'TRUNCATED',
          message: `Space detail fetch capped at ${MAX_SPACES_PER_PROJECT} of ${summaries.length} spaces`,
        });
      }
      const capped = summaries.slice(0, MAX_SPACES_PER_PROJECT);
      spaceList = await mapWithConcurrency(capped, SPACE_FETCH_CONCURRENCY, async (summary) => {
        try {
          return await client.v1.spaces.getSpace(projectUuid, summary.uuid);
        } catch (err) {
          if (!isForbiddenOrNotFound(err)) {
            throw err;
          }
          warnings.push({
            code: 'PARTIAL_VISIBILITY',
            message: `Could not load space detail for ${summary.uuid}`,
            resourceUuid: summary.uuid,
          });
          inaccessibleScopes.push({
            scopeType: 'space',
            scopeUuid: summary.uuid,
            reason: visibilityFailureReason(err),
          });
          return {
            uuid: summary.uuid,
            name: summary.name,
            access: summary.userAccess ? [summary.userAccess] : [],
            groupsAccess: [],
            inheritParentPermissions: summary.inheritParentPermissions,
            inheritsFromOrgOrProject: summary.inheritsFromOrgOrProject,
          };
        }
      });
    }
  } catch (err) {
    if (!isForbiddenOrNotFound(err)) {
      throw err;
    }
    warnings.push({
      code: 'PARTIAL_VISIBILITY',
      message: spaceUuid
        ? `Could not load space ${spaceUuid}`
        : `Could not list spaces for project ${projectUuid}`,
      resourceUuid: spaceUuid ?? projectUuid,
    });
    inaccessibleScopes.push({
      scopeType: spaceUuid ? 'space' : 'project',
      scopeUuid: spaceUuid ?? projectUuid,
      reason: visibilityFailureReason(err),
    });
    return { data: [], warnings, inaccessibleScopes, truncated };
  }

  const data: SpaceAccessRow[] = [];
  for (const space of spaceList) {
    const access = Array.isArray(space.access) ? space.access : [];
    const groupsAccess = Array.isArray(space.groupsAccess) ? space.groupsAccess : [];
    for (const entry of access) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as {
        userUuid?: string;
        role?: string;
        hasDirectAccess?: boolean;
        inheritedFrom?: string;
        inheritedRole?: string;
      };
      data.push({
        spaceUuid: space.uuid,
        spaceName: space.name,
        principalType: 'user',
        principalUuid: row.userUuid,
        role: row.role,
        hasDirectAccess: row.hasDirectAccess,
        inheritedFrom: includeInherited ? row.inheritedFrom : undefined,
        inheritedRole: includeInherited ? row.inheritedRole : undefined,
      });
    }
    for (const entry of groupsAccess) {
      if (!entry || typeof entry !== 'object') continue;
      const row = entry as { groupUuid?: string; spaceRole?: string };
      data.push({
        spaceUuid: space.uuid,
        spaceName: space.name,
        principalType: 'group',
        principalUuid: row.groupUuid,
        role: row.spaceRole,
      });
    }
  }
  return { data, warnings, inaccessibleScopes, truncated };
}

export type EffectiveAccessRecord = {
  principalType: 'group' | 'user';
  principalUuid: string;
  resourceType: 'organization' | 'project' | 'space';
  resourceUuid: string;
  effectiveRole?: string;
  accessPaths: Array<{
    source:
      | 'organization_role'
      | 'project_direct'
      | 'project_group'
      | 'space_direct'
      | 'space_group'
      | 'space_inherited';
    sourceUuid?: string;
    role?: string;
  }>;
  complete: boolean;
  warnings: string[];
};

/** Pure helper for tests: merge observed access paths into records. */
export function composeEffectiveAccessRecords(input: {
  orgAssignments: Array<{
    assigneeType: string;
    assigneeId: string;
    roleName?: string;
    roleId?: string;
  }>;
  projectAssignments: Array<{
    assigneeType: string;
    assigneeId: string;
    roleName?: string;
    roleId?: string;
  }>;
  directAccess: Array<{ userUuid: string; role?: string }>;
  spaceAccess: Array<{
    spaceUuid: string;
    principalType: string;
    principalUuid?: string;
    role?: string;
    inheritedFrom?: string;
    hasDirectAccess?: boolean;
  }>;
  projectUuid: string;
}): EffectiveAccessRecord[] {
  const byKey = new Map<string, EffectiveAccessRecord>();

  const upsert = (
    principalType: 'group' | 'user',
    principalUuid: string,
    resourceType: EffectiveAccessRecord['resourceType'],
    resourceUuid: string,
    path: EffectiveAccessRecord['accessPaths'][number],
    complete: boolean,
    warning?: string,
  ): void => {
    const key = `${principalType}:${principalUuid}:${resourceType}:${resourceUuid}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.accessPaths.push(path);
      existing.complete = existing.complete && complete;
      if (warning) existing.warnings.push(warning);
      if (!existing.effectiveRole && path.role) existing.effectiveRole = path.role;
      return;
    }
    byKey.set(key, {
      principalType,
      principalUuid,
      resourceType,
      resourceUuid,
      effectiveRole: path.role,
      accessPaths: [path],
      complete,
      warnings: warning ? [warning] : [],
    });
  };

  for (const a of input.orgAssignments) {
    if (a.assigneeType !== 'user' && a.assigneeType !== 'group') continue;
    upsert(
      a.assigneeType,
      a.assigneeId,
      'organization',
      'organization',
      { source: 'organization_role', role: a.roleName ?? a.roleId },
      true,
    );
  }
  for (const a of input.projectAssignments) {
    if (a.assigneeType !== 'user' && a.assigneeType !== 'group') continue;
    upsert(
      a.assigneeType,
      a.assigneeId,
      'project',
      input.projectUuid,
      {
        source: a.assigneeType === 'group' ? 'project_group' : 'project_direct',
        role: a.roleName ?? a.roleId,
      },
      false,
      'Org-wide access may also grant project access',
    );
  }
  for (const d of input.directAccess) {
    upsert(
      'user',
      d.userUuid,
      'project',
      input.projectUuid,
      { source: 'project_direct', role: d.role },
      false,
      'Direct access list is incomplete for effective access',
    );
  }
  for (const s of input.spaceAccess) {
    if (!s.principalUuid) continue;
    if (s.principalType !== 'user' && s.principalType !== 'group') continue;
    const inherited = Boolean(s.inheritedFrom) && s.hasDirectAccess === false;
    upsert(
      s.principalType,
      s.principalUuid,
      'space',
      s.spaceUuid,
      {
        source: inherited
          ? 'space_inherited'
          : s.principalType === 'group'
            ? 'space_group'
            : 'space_direct',
        role: s.role,
        sourceUuid: s.inheritedFrom,
      },
      true,
    );
  }

  return [...byKey.values()];
}

export function registerListSpaceAccess(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'list_space_access',
    {
      title: 'List space access',
      description: 'List direct and inherited space access by composing space list/get responses',
      inputSchema: {
        projectUuid: projectUuidField(),
        spaceUuid: z.string().optional(),
        includeInherited: z.boolean().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: { projectUuid: string; spaceUuid?: string; includeInherited?: boolean }) => {
          const session = await resolveSessionOrganization(c);
          const { data, warnings, inaccessibleScopes, truncated } = await loadSpaceAccess(
            c,
            args.projectUuid,
            args.spaceUuid,
            args.includeInherited !== false,
          );
          const complete = warnings.length === 0 && !truncated;
          return jsonToolResult({
            data,
            pagination: {
              returned: data.length,
              complete,
              truncatedReason: truncated ? 'max_results' : undefined,
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              projectUuids: [args.projectUuid],
              inaccessibleScopes,
              complete,
              apiResolutions: [
                {
                  capability: 'space_access',
                  selectedVersion: 'v1',
                  method: 'GET',
                  pathTemplate: '/api/v1/projects/{projectUuid}/spaces[/{spaceUuid}]',
                  reason: 'v2_unavailable',
                },
              ],
            },
            warnings,
          });
        },
    ),
  );
}

export function registerResolveEffectiveAccess(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'resolve_effective_access',
    {
      title: 'Resolve effective access',
      description:
        'Deterministically compose observable org/project/space access paths (completeness flagged)',
      inputSchema: {
        projectUuid: projectUuidField().optional(),
        spaceUuid: z.string().optional(),
        maxPrincipals: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) => async (args: { projectUuid?: string; spaceUuid?: string; maxPrincipals?: number }) => {
        const session = await resolveSessionOrganization(c);
        const pinned = getPinnedProjectUuid();
        const projectUuid = pinned ?? args.projectUuid;
        if (!projectUuid) {
          return jsonToolResult({
            error: 'projectUuid is required when no X-Lightdash-Project pin is set',
            isError: true,
          });
        }

        const warnings: AuditWarning[] = [];
        const inaccessibleScopes: AuditCoverage['inaccessibleScopes'] = [];

        const settle = async <T>(
          label: string,
          scopeType: 'organization' | 'project' | 'space',
          promise: Promise<T>,
        ): Promise<T | undefined> => {
          try {
            return await promise;
          } catch (err) {
            if (!isForbiddenOrNotFound(err)) throw err;
            warnings.push({
              code: 'PARTIAL_VISIBILITY',
              message: `Could not load ${label}`,
              resourceUuid: scopeType === 'organization' ? session.organizationUuid : projectUuid,
            });
            inaccessibleScopes.push({
              scopeType,
              scopeUuid: scopeType === 'organization' ? session.organizationUuid : projectUuid,
              reason: visibilityFailureReason(err),
            });
            return undefined;
          }
        };

        const [orgAssignments, projectAssignments, directAccess, spaceResult] = await Promise.all([
          settle(
            'organization role assignments',
            'organization',
            c.v2.organizationRoles.listRoleAssignments(session.organizationUuid),
          ),
          settle(
            'project role assignments',
            'project',
            c.v2.projectRoleAssignments.listAssignments(projectUuid),
          ),
          settle(
            'project direct access',
            'project',
            c.v1.projectAccess.listProjectAccess(projectUuid),
          ),
          loadSpaceAccess(c, projectUuid, args.spaceUuid, true),
        ]);

        inaccessibleScopes.push(...spaceResult.inaccessibleScopes);

        let records = composeEffectiveAccessRecords({
          orgAssignments: orgAssignments ?? [],
          projectAssignments: projectAssignments ?? [],
          directAccess: directAccess ?? [],
          spaceAccess: spaceResult.data,
          projectUuid,
        });

        const maxPrincipals = args.maxPrincipals ?? 500;
        const principalsTruncated = records.length > maxPrincipals;
        if (principalsTruncated) records = records.slice(0, maxPrincipals);
        const truncated = principalsTruncated || spaceResult.truncated;

        return jsonToolResult({
          data: records,
          pagination: {
            returned: records.length,
            complete: false,
            truncatedReason: truncated ? 'max_results' : undefined,
          },
          coverage: {
            ...emptyCoverage(session.organizationUuid, pinned),
            projectUuids: [projectUuid],
            inaccessibleScopes,
            complete: false,
          },
          warnings: [
            {
              code: 'INCOMPLETE_EFFECTIVE_ACCESS',
              message:
                'Effective access is best-effort from observable APIs; role precedence is not invented when paths conflict',
            },
            ...warnings,
            ...spaceResult.warnings,
            ...(truncated
              ? [
                  {
                    code: 'TRUNCATED' as const,
                    message: principalsTruncated
                      ? `Truncated to ${maxPrincipals} principals`
                      : 'Space inventory truncated during access composition',
                  },
                ]
              : []),
          ],
        });
      },
    ),
  );
}

/* eslint-enable max-params, sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity */
