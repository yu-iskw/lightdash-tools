/**
 * Organization member operations in the shared operation registry.
 */

import { READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE } from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor } from './types';

const PROFILE_DISCOVERY: CapabilityProfile = 'discovery-readonly';

const API_V1 = '/api/v1';
const MEMBERS_PATH = `${API_V1}/org/users`;
const MEMBER_PATH = `${MEMBERS_PATH}/{userUuid}`;
const DELETE_MEMBER_PATH = `${API_V1}/org/user/{userUuid}`;

const membersList = defineOperation({
  id: 'users.members.list',
  summary: 'List organization members (one page)',
  http: { method: 'GET', path: MEMBERS_PATH },
  authorization: { safetyImpact: 'read' },
  mcp: {
    toolName: 'list_organization_members',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'users list' },
  profiles: [PROFILE_DISCOVERY],
});

const membersGet = defineOperation({
  id: 'users.members.get',
  summary: 'Get an organization member by UUID',
  http: { method: 'GET', path: MEMBER_PATH },
  authorization: { safetyImpact: 'read' },
  mcp: {
    toolName: 'get_member',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'users get' },
  profiles: [PROFILE_DISCOVERY],
});

const membersDelete = defineOperation({
  id: 'users.members.delete',
  summary: 'Permanently remove a user from the organization (irrecoverable; client-only)',
  http: { method: 'DELETE', path: DELETE_MEMBER_PATH },
  authorization: { safetyImpact: 'write-destructive' },
  mcp: {
    toolName: 'delete_member',
    annotations: WRITE_DESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'users delete' },
  agentExposure: 'client-only',
  profiles: [PROFILE_DISCOVERY],
});

/** Organization member operations registered in the shared operation registry. */
export const USER_OPERATIONS: readonly OperationDescriptor[] = [
  membersList,
  membersGet,
  membersDelete,
];
