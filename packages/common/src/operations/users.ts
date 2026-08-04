/**
 * Organization member operations in the shared operation catalog.
 */

import { READ_ONLY_DEFAULT } from '../safety';

import { defineOperation } from './types';

import type { OperationDescriptor } from './types';

const API_V1 = '/api/v1';
const MEMBERS_PATH = `${API_V1}/org/users`;
const MEMBER_PATH = `${MEMBERS_PATH}/{userUuid}`;
const DELETE_MEMBER_PATH = `${API_V1}/org/user/{userUuid}`;

const membersList = defineOperation({
  id: 'users.members.list',
  summary: 'List organization members (one page)',
  http: { method: 'GET', path: MEMBERS_PATH },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'pii.email',
  mcp: {
    toolName: 'list_organization_members',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'users list' },
});

const membersGet = defineOperation({
  id: 'users.members.get',
  summary: 'Get an organization member by UUID',
  http: { method: 'GET', path: MEMBER_PATH },
  authorization: { safetyImpact: 'read' },
  sensitivity: 'pii.email',
  mcp: {
    toolName: 'get_member',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'users get' },
});

const membersDelete = defineOperation({
  id: 'users.members.delete',
  summary: 'Permanently remove a user from the organization (irrecoverable; client-only)',
  http: { method: 'DELETE', path: DELETE_MEMBER_PATH },
  authorization: { safetyImpact: 'write-destructive' },
  sensitivity: 'none',
  agentExposure: 'client-only',
  bannedMcpToolName: 'delete_member',
});

/** Organization member operations registered in the shared operation catalog. */
export const USER_OPERATIONS: readonly OperationDescriptor[] = [
  membersList,
  membersGet,
  membersDelete,
];
