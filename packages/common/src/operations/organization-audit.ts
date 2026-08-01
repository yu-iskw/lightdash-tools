/**
 * Organization-audit operations in the shared operation catalog (ADR-0013).
 */
import { READ_ONLY_DEFAULT } from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor } from './types';

const PROFILE_ORG_AUDIT: CapabilityProfile = 'org-audit-readonly';

const op_get_org_profile = defineOperation({
  id: 'org-audit.org.profile.get',
  summary: 'Get organization profile for the authenticated user',
  http: { method: 'GET', path: '/api/v1/org' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_org_profile',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'organization get' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_org_members = defineOperation({
  id: 'org-audit.members.list',
  summary: 'List organization members',
  http: { method: 'GET', path: '/api/v1/org/users' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'pii.email',
  mcp: {
    toolName: 'list_org_members',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'users list' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_get_org_member = defineOperation({
  id: 'org-audit.members.get',
  summary: 'Get an organization member by UUID',
  http: { method: 'GET', path: '/api/v1/org/users/{userUuid}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'pii.email',
  mcp: {
    toolName: 'get_org_member',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'users get' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_org_groups = defineOperation({
  id: 'org-audit.groups.list',
  summary: 'List organization groups',
  http: { method: 'GET', path: '/api/v1/org/groups' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'pii.email',
  mcp: {
    toolName: 'list_org_groups',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'groups list' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_org_projects = defineOperation({
  id: 'org-audit.projects.list',
  summary: 'List organization projects without connection secrets',
  http: { method: 'GET', path: '/api/v1/org/projects' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'secret.connection',
  mcp: {
    toolName: 'list_org_projects',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects list' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_org_role_assignments = defineOperation({
  id: 'org-audit.roles.assignments.list',
  summary: 'List organization role assignments',
  http: { method: 'GET', path: '/api/v2/orgs/{orgUuid}/roles/assignments' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_org_role_assignments',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_custom_roles = defineOperation({
  id: 'org-audit.roles.list',
  summary: 'List organization custom and system roles',
  http: { method: 'GET', path: '/api/v2/orgs/{orgUuid}/roles' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_custom_roles',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_get_custom_role = defineOperation({
  id: 'org-audit.roles.get',
  summary: 'Get a role including scopes',
  http: { method: 'GET', path: '/api/v2/orgs/{orgUuid}/roles/{roleUuid}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_custom_role',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_project_roles = defineOperation({
  id: 'org-audit.project.roles.list',
  summary: 'List project role assignments',
  http: { method: 'GET', path: '/api/v2/projects/{projectId}/roles/assignments' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_project_roles',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects roles list' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_project_direct_access = defineOperation({
  id: 'org-audit.project.access.list',
  summary: 'List direct project user access grants',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/access' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'pii.email',
  mcp: {
    toolName: 'list_project_direct_access',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'projects access list' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_space_access = defineOperation({
  id: 'org-audit.space.access.list',
  summary: 'Compose space ACL from space list/get',
  http: { method: 'GET', path: '/api/v1/projects/{projectUuid}/spaces' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_space_access',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_resolve_effective_access = defineOperation({
  id: 'org-audit.access.resolve',
  summary: 'Best-effort effective access composition',
  http: { method: 'GET', path: '/api/v2/orgs/{orgUuid}/roles/assignments' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'resolve_effective_access',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_content = defineOperation({
  id: 'org-audit.content.list',
  summary: 'List charts dashboards and spaces',
  http: { method: 'GET', path: '/api/v2/content' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_content',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'content search' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_get_dashboard_meta = defineOperation({
  id: 'org-audit.dashboards.meta.get',
  summary: 'Get dashboard metadata without executing queries',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/dashboards/{dashboardUuidOrSlug}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_dashboard_meta',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_validation_results = defineOperation({
  id: 'org-audit.validation.list',
  summary: 'List project validation failures',
  http: { method: 'GET', path: '/api/v2/projects/{projectUuid}/validate' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_validation_results',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_get_project_user_activity = defineOperation({
  id: 'org-audit.analytics.user-activity.get',
  summary: 'Get project user activity analytics',
  http: { method: 'GET', path: '/api/v1/analytics/user-activity/{projectUuid}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_project_user_activity',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_list_project_schedulers = defineOperation({
  id: 'org-audit.schedulers.list',
  summary: 'List project schedulers with destinations redacted by default',
  http: { method: 'GET', path: '/api/v1/schedulers/{projectUuid}/list' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'secret.destination',
  mcp: {
    toolName: 'list_project_schedulers',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'schedulers list' },
  profiles: [PROFILE_ORG_AUDIT],
});

const op_get_scheduler = defineOperation({
  id: 'org-audit.schedulers.get',
  summary: 'Get a scheduler by UUID with destinations redacted by default',
  http: { method: 'GET', path: '/api/v1/schedulers/{schedulerUuid}' },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'secret.destination',
  mcp: {
    toolName: 'get_scheduler',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'schedulers get' },
  profiles: [PROFILE_ORG_AUDIT],
});

export const ORGANIZATION_AUDIT_OPERATIONS: readonly OperationDescriptor[] = [
  op_get_org_profile,
  op_list_org_members,
  op_get_org_member,
  op_list_org_groups,
  op_list_org_projects,
  op_list_org_role_assignments,
  op_list_custom_roles,
  op_get_custom_role,
  op_list_project_roles,
  op_list_project_direct_access,
  op_list_space_access,
  op_resolve_effective_access,
  op_list_content,
  op_get_dashboard_meta,
  op_list_validation_results,
  op_get_project_user_activity,
  op_list_project_schedulers,
  op_get_scheduler,
];
