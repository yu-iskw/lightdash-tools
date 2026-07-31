/**
 * Composed organization-audit finding tools.
 */

/* eslint-disable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity --
 * Audit rule evaluation is inherently multi-branch; keep findings deterministic in one module.
 */

import { z } from 'zod';

import { getPinnedProjectUuid } from '../../../governance/project-pin.js';
import { jsonToolResult, wrapTool } from '../../shared.js';
import { composeEffectiveAccessRecords } from '../access.js';
import { asPaginated } from '../api-shape.js';
import { mapWithConcurrency } from '../concurrency.js';
import { emptyCoverage } from '../contracts.js';
import { resolveSessionOrganization } from '../org-binding.js';
import { normalizeScheduler } from '../redaction.js';
import { registerOrgAuditTool } from '../register.js';

import type { McpContextProvider } from '../../../server/request-context.js';
import type { AuditFinding } from '../contracts.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

const PRIVILEGED_ROLES = new Set(['admin', 'developer']);
const MAX_MEMBERS_FOR_AUDIT = 2000;
const PROJECT_SCAN_CONCURRENCY = 3;

function finding(
  partial: Omit<AuditFinding, 'evidence'> & { evidence?: AuditFinding['evidence'] },
): AuditFinding {
  return { evidence: [], ...partial };
}

type MemberRow = {
  userUuid: string;
  role?: string | null;
  isActive?: boolean;
  isPending?: boolean;
  isInviteExpired?: boolean | null;
};

/** Paginate members up to a hard cap so orphan checks are not limited to one page. */
async function loadMembersCapped(
  client: LightdashClient,
  max = MAX_MEMBERS_FOR_AUDIT,
): Promise<{ members: MemberRow[]; truncated: boolean }> {
  const pageSize = 500;
  const members: MemberRow[] = [];
  let page = 1;
  let truncated = false;

  for (;;) {
    const result = await client.v1.users.listMembers({ page, pageSize });
    const data = result.data ?? [];
    members.push(...data);
    const totalPages = result.pagination?.totalPageCount;
    const exhausted = data.length === 0 || (typeof totalPages === 'number' && page >= totalPages);
    if (members.length >= max) {
      truncated =
        !exhausted ||
        (typeof result.pagination?.totalResults === 'number' &&
          result.pagination.totalResults > max);
      break;
    }
    if (exhausted) break;
    page += 1;
  }

  return { members: members.slice(0, max), truncated };
}

function contentOwnerUuid(createdBy: unknown): string | undefined {
  if (!createdBy || typeof createdBy !== 'object') return undefined;
  const row = createdBy as { uuid?: string; userUuid?: string };
  return row.uuid ?? row.userUuid;
}

async function resolveProjectUuids(
  client: LightdashClient,
  requested?: string[],
  maximumProjects = 25,
): Promise<string[]> {
  const pinned = getPinnedProjectUuid();
  if (pinned) return [pinned];
  if (requested?.length) return requested.slice(0, maximumProjects);
  const projects = await client.v1.projects.listProjects();
  return projects
    .filter((p) => p.type !== 'PREVIEW')
    .map((p) => p.projectUuid)
    .slice(0, maximumProjects);
}

export async function runIdentityAccessAudit(
  client: LightdashClient,
  opts: {
    projectUuids?: string[];
    includePending?: boolean;
    privilegedRoleNames?: string[];
    maxFindings?: number;
    members?: MemberRow[];
    membersTruncated?: boolean;
  },
): Promise<{ findings: AuditFinding[]; assumptions: Record<string, unknown> }> {
  const session = await resolveSessionOrganization(client);
  const privileged = new Set(
    (opts.privilegedRoleNames ?? [...PRIVILEGED_ROLES]).map((r) => r.toLowerCase()),
  );
  const { members, truncated: membersTruncated } =
    opts.members !== undefined
      ? { members: opts.members, truncated: opts.membersTruncated === true }
      : await loadMembersCapped(client);
  const orgAssignments = await client.v2.organizationRoles.listRoleAssignments(
    session.organizationUuid,
  );
  const findings: AuditFinding[] = [];
  const now = new Date().toISOString();

  for (const m of members) {
    const role = String(m.role ?? '').toLowerCase();
    const isPrivileged = privileged.has(role);
    if (isPrivileged && m.isActive === false) {
      findings.push(
        finding({
          ruleId: 'privileged_inactive_member',
          title: 'Inactive privileged member',
          domain: 'identity',
          severity: 'high',
          confidence: 'high',
          status: 'observed',
          summary: `Inactive user ${m.userUuid} retains organization role ${m.role}`,
          policyAssumptions: { privilegedRoles: [...privileged] },
          evidence: [
            {
              resourceType: 'organization_member',
              resourceUuid: m.userUuid,
              attributes: { role: m.role, isActive: m.isActive },
              sourceTool: 'lightdash_list_org_members',
              observedAt: now,
            },
          ],
        }),
      );
    }
    if (opts.includePending !== false && isPrivileged && m.isPending) {
      findings.push(
        finding({
          ruleId: 'pending_privileged_invite',
          title: 'Pending privileged invitation',
          domain: 'identity',
          severity: 'review',
          confidence: 'medium',
          status: 'observed',
          summary: `Pending user ${m.userUuid} has privileged role ${m.role}`,
          policyAssumptions: { privilegedRoles: [...privileged] },
          evidence: [
            {
              resourceType: 'organization_member',
              resourceUuid: m.userUuid,
              attributes: {
                role: m.role,
                isPending: m.isPending,
                isInviteExpired: m.isInviteExpired,
              },
              sourceTool: 'lightdash_list_org_members',
              observedAt: now,
            },
          ],
        }),
      );
    }
  }

  const memberIds = new Set(members.map((m) => m.userUuid));
  for (const a of orgAssignments) {
    if (a.assigneeType === 'user' && !memberIds.has(a.assigneeId)) {
      findings.push(
        finding({
          ruleId: 'orphan_role_assignment',
          title: 'Orphaned role assignment',
          domain: 'authorization',
          severity: 'high',
          confidence: membersTruncated ? 'low' : 'medium',
          status: membersTruncated ? 'suspected' : 'observed',
          summary: `Assignment references missing user ${a.assigneeId}`,
          policyAssumptions: { membersTruncated },
          evidence: [
            {
              resourceType: 'role_assignment',
              resourceUuid: a.assigneeId,
              attributes: { roleId: a.roleId, roleName: a.roleName },
              sourceTool: 'lightdash_list_org_role_assignments',
              observedAt: now,
            },
          ],
        }),
      );
    }
  }

  const projectUuids = await resolveProjectUuids(client, opts.projectUuids);
  await mapWithConcurrency(projectUuids, PROJECT_SCAN_CONCURRENCY, async (projectUuid) => {
    const [projectAssignments, directAccess] = await Promise.all([
      client.v2.projectRoleAssignments.listAssignments(projectUuid),
      client.v1.projectAccess.listProjectAccess(projectUuid),
    ]);
    const records = composeEffectiveAccessRecords({
      orgAssignments,
      projectAssignments,
      directAccess,
      spaceAccess: [],
      projectUuid,
    });
    for (const r of records) {
      if (r.accessPaths.length > 1) {
        findings.push(
          finding({
            ruleId: 'redundant_access_path',
            title: 'Redundant access paths',
            domain: 'authorization',
            severity: 'info',
            confidence: 'medium',
            status: 'observed',
            summary: `${r.principalType} ${r.principalUuid} has ${r.accessPaths.length} paths to ${r.resourceType} ${r.resourceUuid}`,
            policyAssumptions: {},
            evidence: [
              {
                resourceType: r.resourceType,
                resourceUuid: r.resourceUuid,
                attributes: { accessPaths: r.accessPaths },
                sourceTool: 'lightdash_resolve_effective_access',
                observedAt: now,
              },
            ],
          }),
        );
      }
    }
  });

  const maxFindings = opts.maxFindings ?? 500;
  return {
    findings: findings.slice(0, maxFindings),
    assumptions: {
      privilegedRoles: [...privileged],
      includePending: opts.includePending !== false,
      inactiveDays: 'not_evaluated_without_activity_timestamps',
      membersTruncated,
      membersObserved: members.length,
    },
  };
}

export async function runContentHealthAudit(
  client: LightdashClient,
  opts: {
    projectUuids?: string[];
    minimumViewsForHighImpact?: number;
    includeUnused?: boolean;
    maxFindings?: number;
    members?: MemberRow[];
    membersTruncated?: boolean;
  },
): Promise<{ findings: AuditFinding[]; assumptions: Record<string, unknown> }> {
  const findings: AuditFinding[] = [];
  const now = new Date().toISOString();
  const minViews = opts.minimumViewsForHighImpact ?? 10;
  const projectUuids = await resolveProjectUuids(client, opts.projectUuids);
  const { members, truncated: membersTruncated } =
    opts.members !== undefined
      ? { members: opts.members, truncated: opts.membersTruncated === true }
      : await loadMembersCapped(client);
  const inactive = new Set(members.filter((m) => m.isActive === false).map((m) => m.userUuid));
  const seenInactiveOwners = new Set<string>();
  let contentSampleTruncated = false;

  const evaluateContentRows = (
    rows: Array<Record<string, unknown>>,
    mode: 'high_views' | 'unused',
    broken: Set<string>,
  ): void => {
    for (const row of rows) {
      const uuid = typeof row.uuid === 'string' ? row.uuid : undefined;
      if (!uuid) continue;
      const views = typeof row.views === 'number' ? row.views : 0;
      const ownerUuid = contentOwnerUuid(row.createdBy);
      const contentType = typeof row.contentType === 'string' ? row.contentType : 'content';
      const name = typeof row.name === 'string' ? row.name : undefined;

      if (mode === 'high_views') {
        if (broken.has(uuid) && views >= minViews) {
          findings.push(
            finding({
              ruleId: 'high_usage_broken_content',
              title: 'High-usage broken content',
              domain: 'content',
              severity: 'high',
              confidence: 'medium',
              status: 'observed',
              summary: `${contentType} ${uuid} has validation issues and ${views} views`,
              policyAssumptions: { minimumViewsForHighImpact: minViews },
              evidence: [
                {
                  resourceType: contentType,
                  resourceUuid: uuid,
                  attributes: { views, name },
                  sourceTool: 'lightdash_list_content',
                  observedAt: now,
                },
              ],
            }),
          );
        }
      } else if (views === 0) {
        findings.push(
          finding({
            ruleId: 'unused_content',
            title: 'Unused content',
            domain: 'usage',
            severity: 'info',
            confidence: 'low',
            status: 'observed',
            summary: `${contentType} ${uuid} has zero views (review signal, not a deletion recommendation)`,
            policyAssumptions: { deletionNeverFromLowUsageAlone: true },
            remediationGuidance: 'Review with owner; do not delete solely because of low usage',
            evidence: [
              {
                resourceType: contentType,
                resourceUuid: uuid,
                attributes: { views: 0, name },
                sourceTool: 'lightdash_list_content',
                observedAt: now,
              },
            ],
          }),
        );
      }

      if (ownerUuid && inactive.has(ownerUuid) && !seenInactiveOwners.has(uuid)) {
        seenInactiveOwners.add(uuid);
        findings.push(
          finding({
            ruleId: 'content_owned_by_inactive_user',
            title: 'Content owned by inactive user',
            domain: 'content',
            severity: 'high',
            confidence: membersTruncated ? 'medium' : 'high',
            status: 'observed',
            summary: `${contentType} ${uuid} owned by inactive user ${ownerUuid}`,
            policyAssumptions: { membersTruncated },
            evidence: [
              {
                resourceType: contentType,
                resourceUuid: uuid,
                attributes: { ownerUuid, name },
                sourceTool: 'lightdash_list_content',
                observedAt: now,
              },
            ],
          }),
        );
      }
    }
  };

  await mapWithConcurrency(projectUuids, PROJECT_SCAN_CONCURRENCY, async (projectUuid) => {
    const includeUnused = opts.includeUnused !== false;
    const [contentDesc, contentAsc, validation] = await Promise.all([
      client.v2.content.searchContent({
        projectUuids: [projectUuid],
        pageSize: 200,
        sortBy: 'views',
        sortDirection: 'desc',
      }),
      includeUnused
        ? client.v2.content.searchContent({
            projectUuids: [projectUuid],
            pageSize: 200,
            sortBy: 'views',
            sortDirection: 'asc',
          })
        : Promise.resolve(undefined),
      client.v2.validation.listValidationResults(projectUuid, { pageSize: 200 }),
    ]);
    const contentPage = asPaginated<Record<string, unknown>>(contentDesc);
    const unusedPage = contentAsc
      ? asPaginated<Record<string, unknown>>(contentAsc)
      : { data: [] as Array<Record<string, unknown>>, pagination: undefined };
    const validationPage = asPaginated<Record<string, unknown>>(validation);
    if (
      (contentPage.pagination?.totalResults ?? 0) > contentPage.data.length ||
      (unusedPage.pagination?.totalResults ?? 0) > unusedPage.data.length ||
      (validationPage.pagination?.totalResults ?? 0) > validationPage.data.length
    ) {
      contentSampleTruncated = true;
    }
    const brokenUuids = new Set(
      validationPage.data
        .map((v) => {
          const row = v;
          return (
            (typeof row.chartUuid === 'string' && row.chartUuid) ||
            (typeof row.dashboardUuid === 'string' && row.dashboardUuid) ||
            (typeof row.uuid === 'string' && row.uuid) ||
            undefined
          );
        })
        .filter((id): id is string => Boolean(id)),
    );

    evaluateContentRows(contentPage.data, 'high_views', brokenUuids);
    if (includeUnused) {
      evaluateContentRows(unusedPage.data, 'unused', brokenUuids);
    }
  });

  return {
    findings: findings.slice(0, opts.maxFindings ?? 500),
    assumptions: {
      minimumViewsForHighImpact: minViews,
      includeUnused: opts.includeUnused !== false,
      deletionNeverFromLowUsageAlone: true,
      membersTruncated,
      membersObserved: members.length,
      unusedContentSort: 'views_asc_separate_page',
      contentSampleTruncated,
      contentPageSize: 200,
    },
  };
}

export async function runScheduledDeliveriesAudit(
  client: LightdashClient,
  opts: {
    projectUuids?: string[];
    allowedEmailDomains?: string[];
    includeDisabled?: boolean;
    maxFindings?: number;
    maxSchedules?: number;
    members?: MemberRow[];
    membersTruncated?: boolean;
  },
): Promise<{ findings: AuditFinding[]; assumptions: Record<string, unknown> }> {
  const findings: AuditFinding[] = [];
  const now = new Date().toISOString();
  const { members, truncated: membersTruncated } =
    opts.members !== undefined
      ? { members: opts.members, truncated: opts.membersTruncated === true }
      : await loadMembersCapped(client);
  const inactive = new Set(members.filter((m) => m.isActive === false).map((m) => m.userUuid));
  const projectUuids = await resolveProjectUuids(client, opts.projectUuids);
  const maxSchedules = opts.maxSchedules ?? 500;
  let seen = 0;
  let schedulersTruncated = false;

  for (let projectIndex = 0; projectIndex < projectUuids.length; projectIndex += 1) {
    if (seen >= maxSchedules) {
      schedulersTruncated = true;
      break;
    }
    const projectUuid = projectUuids[projectIndex] as string;
    const result = await client.v1.schedulers.listSchedulers(projectUuid, {
      pageSize: 100,
      includeLatestRun: true,
    });
    const { data: rows, pagination } = asPaginated<Record<string, unknown>>(result);
    if ((pagination?.totalResults ?? 0) > rows.length) {
      schedulersTruncated = true;
    }
    for (const raw of rows) {
      if (seen >= maxSchedules) {
        schedulersTruncated = true;
        break;
      }
      const s = normalizeScheduler(raw, false, opts.allowedEmailDomains);
      const enabled = s.enabled !== false;
      if (!enabled && opts.includeDisabled === false) continue;
      seen += 1;
      const ownerUuid = String(s.createdByUserUuid ?? '');
      const schedulerUuid = String(s.schedulerUuid ?? '');
      if (enabled && ownerUuid && inactive.has(ownerUuid)) {
        findings.push(
          finding({
            ruleId: 'delivery_owned_by_inactive_user',
            title: 'Scheduler owned by inactive user',
            domain: 'delivery',
            severity: 'high',
            confidence: membersTruncated ? 'medium' : 'high',
            status: 'observed',
            summary: `Enabled scheduler ${schedulerUuid} owned by inactive user ${ownerUuid}`,
            policyAssumptions: { membersTruncated },
            evidence: [
              {
                resourceType: 'scheduler',
                resourceUuid: schedulerUuid,
                attributes: { ownerUuid, enabled },
                sourceTool: 'lightdash_list_project_schedulers',
                observedAt: now,
              },
            ],
          }),
        );
      }
      const targets = Array.isArray(s.targets) ? s.targets : [];
      for (const t of targets) {
        if (!t || typeof t !== 'object') continue;
        const target = t as Record<string, unknown>;
        // Email externality requires an allowlist; webhook URLs are always "external" in
        // redactDestination and must not trigger this email-domain review rule.
        const destinationType = String(target.destinationType ?? '');
        const isEmailDestination =
          destinationType === 'email' ||
          (typeof target.redactedDestination === 'string' &&
            target.redactedDestination.includes('@'));
        if (!isEmailDestination || target.isExternalDomain !== true) continue;
        findings.push(
          finding({
            ruleId: 'external_scheduled_delivery',
            title: 'External scheduled delivery',
            domain: 'delivery',
            severity: 'review',
            confidence: 'medium',
            status: 'observed',
            summary: `Scheduler ${schedulerUuid} targets external domain ${String(target.domain ?? 'unknown')}`,
            policyAssumptions: { allowedEmailDomains: opts.allowedEmailDomains ?? [] },
            evidence: [
              {
                resourceType: 'scheduler',
                resourceUuid: schedulerUuid,
                attributes: {
                  destination: {
                    destinationType: target.destinationType,
                    redactedDestination: target.redactedDestination,
                    domain: target.domain,
                    isExternalDomain: true,
                  },
                },
                sourceTool: 'lightdash_list_project_schedulers',
                observedAt: now,
              },
            ],
          }),
        );
      }
    }
  }

  return {
    findings: findings.slice(0, opts.maxFindings ?? 500),
    assumptions: {
      allowedEmailDomains: opts.allowedEmailDomains ?? [],
      externalDestinationIsReviewSignalNotViolation: true,
      membersTruncated,
      membersObserved: members.length,
      schedulersTruncated,
      schedulesObserved: seen,
      externalDeliveryRequiresAllowedEmailDomains: true,
    },
  };
}

export function registerAuditIdentityAccess(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'audit_identity_access',
    {
      title: 'Audit identity and access',
      description: 'Evidence-backed identity and authorization findings',
      inputSchema: {
        projectUuids: z.array(z.string()).optional(),
        includePending: z.boolean().optional(),
        privilegedRoleNames: z.array(z.string()).optional(),
        maxFindings: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuids?: string[];
          includePending?: boolean;
          privilegedRoleNames?: string[];
          maxFindings?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const { findings, assumptions } = await runIdentityAccessAudit(c, args);
          return jsonToolResult({
            findings,
            assumptions,
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              complete: false,
            },
            warnings:
              session.auditVisibility === 'organization_admin'
                ? [
                    {
                      code: 'TRUNCATED' as const,
                      message:
                        'Identity/access audit is bounded (members/projects/spaces); coverage.complete stays false',
                    },
                  ]
                : [
                    {
                      code: 'PARTIAL_VISIBILITY',
                      message: 'Caller may not have organization-admin visibility',
                    },
                  ],
          });
        },
    ),
  );
}

export function registerAuditContentHealth(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'audit_content_health',
    {
      title: 'Audit content health',
      description: 'Join content, validation, ownership, and usage into findings',
      inputSchema: {
        projectUuids: z.array(z.string()).optional(),
        minimumViewsForHighImpact: z.number().int().nonnegative().optional(),
        includeUnused: z.boolean().optional(),
        maxFindings: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuids?: string[];
          minimumViewsForHighImpact?: number;
          includeUnused?: boolean;
          maxFindings?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const { findings, assumptions } = await runContentHealthAudit(c, args);
          return jsonToolResult({
            findings,
            assumptions,
            coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            warnings: assumptions.contentSampleTruncated
              ? [
                  {
                    code: 'TRUNCATED' as const,
                    message:
                      'Content/validation sample capped at pageSize 200 per sort; more inventory may exist',
                  },
                ]
              : [],
          });
        },
    ),
  );
}

export function registerAuditScheduledDeliveries(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'audit_scheduled_deliveries',
    {
      title: 'Audit scheduled deliveries',
      description: 'Review outbound delivery configuration without executing schedules',
      inputSchema: {
        projectUuids: z.array(z.string()).optional(),
        allowedEmailDomains: z.array(z.string()).optional(),
        includeDisabled: z.boolean().optional(),
        maxSchedules: z.number().int().positive().optional(),
        maxFindings: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuids?: string[];
          allowedEmailDomains?: string[];
          includeDisabled?: boolean;
          maxSchedules?: number;
          maxFindings?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const { findings, assumptions } = await runScheduledDeliveriesAudit(c, args);
          const warnings: Array<{ code: 'REDACTED' | 'TRUNCATED'; message: string }> = [
            { code: 'REDACTED', message: 'Destination details are redacted in evidence' },
          ];
          if (!args.allowedEmailDomains?.length) {
            warnings.push({
              code: 'REDACTED',
              message:
                'Pass allowedEmailDomains to enable external-destination review findings; without it isExternalDomain stays false',
            });
          }
          if (assumptions.schedulersTruncated) {
            warnings.push({
              code: 'TRUNCATED',
              message: 'Scheduler inventory sampling was truncated; more schedules may exist',
            });
          }
          return jsonToolResult({
            findings,
            assumptions,
            coverage: emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
            warnings,
          });
        },
    ),
  );
}

export function registerAuditOrgSummary(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerOrgAuditTool(
    server,
    'audit_org_summary',
    {
      title: 'Generate organization audit summary',
      description: 'Bounded full audit using the same modules as focused audit tools',
      inputSchema: {
        projectUuids: z.array(z.string()).optional(),
        domains: z
          .array(z.enum(['identity', 'authorization', 'content', 'usage', 'delivery']))
          .optional(),
        allowedEmailDomains: z.array(z.string()).optional(),
        maximumProjects: z.number().int().positive().optional(),
        maximumFindings: z.number().int().positive().optional(),
      },
    },
    wrapTool(
      contextProvider,
      (c) =>
        async (args: {
          projectUuids?: string[];
          domains?: Array<'authorization' | 'content' | 'delivery' | 'identity' | 'usage'>;
          allowedEmailDomains?: string[];
          maximumProjects?: number;
          maximumFindings?: number;
        }) => {
          const session = await resolveSessionOrganization(c);
          const domains = new Set(
            args.domains ?? ['identity', 'authorization', 'content', 'usage', 'delivery'],
          );
          const projectUuids = await resolveProjectUuids(
            c,
            args.projectUuids,
            args.maximumProjects ?? 25,
          );
          const maxFindings = args.maximumFindings ?? 500;
          const findings: AuditFinding[] = [];
          const assumptions: Record<string, unknown> = {};
          const { members, truncated: membersTruncated } = await loadMembersCapped(c);
          assumptions.membersTruncated = membersTruncated;
          assumptions.membersObserved = members.length;

          if (domains.has('identity') || domains.has('authorization')) {
            const r = await runIdentityAccessAudit(c, {
              projectUuids,
              maxFindings,
              members,
              membersTruncated,
            });
            findings.push(...r.findings);
            Object.assign(assumptions, r.assumptions);
          }
          if (domains.has('content') || domains.has('usage')) {
            const r = await runContentHealthAudit(c, {
              projectUuids,
              maxFindings,
              members,
              membersTruncated,
            });
            findings.push(...r.findings);
            Object.assign(assumptions, r.assumptions);
          }
          if (domains.has('delivery')) {
            const r = await runScheduledDeliveriesAudit(c, {
              projectUuids,
              allowedEmailDomains: args.allowedEmailDomains,
              maxFindings,
              members,
              membersTruncated,
            });
            findings.push(...r.findings);
            Object.assign(assumptions, r.assumptions);
          }

          const limited = findings.slice(0, maxFindings);
          const findingsBySeverity: Record<string, number> = {};
          for (const f of limited) {
            findingsBySeverity[f.severity] = (findingsBySeverity[f.severity] ?? 0) + 1;
          }

          const warnings: Array<{
            code: 'PARTIAL_VISIBILITY' | 'REDACTED' | 'TRUNCATED';
            message: string;
          }> = [];
          if (limited.length < findings.length) {
            warnings.push({ code: 'TRUNCATED', message: `Findings truncated to ${maxFindings}` });
          }
          if (assumptions.membersTruncated === true) {
            warnings.push({
              code: 'TRUNCATED',
              message: 'Member inventory was capped; inactive/orphan checks may be incomplete',
            });
          }
          if (assumptions.contentSampleTruncated === true) {
            warnings.push({
              code: 'TRUNCATED',
              message: 'Content/validation sample was capped; more inventory may exist',
            });
          }
          if (assumptions.schedulersTruncated === true) {
            warnings.push({
              code: 'TRUNCATED',
              message: 'Scheduler inventory sampling was truncated; more schedules may exist',
            });
          }
          if (domains.has('delivery') && !args.allowedEmailDomains?.length) {
            warnings.push({
              code: 'REDACTED',
              message:
                'Pass allowedEmailDomains to enable external-destination review findings; without it isExternalDomain stays false',
            });
          }
          if (session.auditVisibility !== 'organization_admin') {
            warnings.push({
              code: 'PARTIAL_VISIBILITY',
              message: 'Caller may not have organization-admin visibility',
            });
          }

          return jsonToolResult({
            executiveSummary: {
              observedAt: new Date().toISOString(),
              organizationUuid: session.organizationUuid,
              projectsAudited: projectUuids.length,
              findingsBySeverity,
              confidence: session.auditVisibility === 'organization_admin' ? 'medium' : 'low',
            },
            findings: limited,
            domainSummaries: {
              domains: [...domains],
            },
            coverage: {
              ...emptyCoverage(session.organizationUuid, getPinnedProjectUuid()),
              projectUuids,
              complete: false,
            },
            assumptions,
            recommendedNextActions: [
              'Investigate high and critical findings with evidence UUIDs',
              'Confirm policy thresholds before treating review signals as violations',
              'Re-run focused audits after remediations',
            ],
            warnings,
          });
        },
    ),
  );
}

/* eslint-enable sonarjs/cognitive-complexity, sonarjs/cyclomatic-complexity */
