/**
 * Session organization binding for organization-audit tools.
 */

import type { LightdashClient } from '@lightdash-tools/client';

export type SessionOrganization = {
  organizationUuid: string;
  organizationName?: string;
  currentUserUuid: string;
  currentUserOrganizationRole?: string;
  currentUserRoleUuid?: string;
  auditVisibility: 'organization_admin' | 'partial' | 'unknown';
};

/** Resolve authenticated org/user for the current session. */
export async function resolveSessionOrganization(
  client: LightdashClient,
): Promise<SessionOrganization> {
  const user = await client.v1.users.getAuthenticatedUser();
  const organizationUuid = user.organizationUuid;
  if (!organizationUuid) {
    throw new Error('Authenticated user has no organizationUuid');
  }

  const role = user.role;
  let auditVisibility: SessionOrganization['auditVisibility'] = 'unknown';
  if (role === 'admin') {
    auditVisibility = 'organization_admin';
  } else if (role) {
    auditVisibility = 'partial';
  }

  return {
    organizationUuid,
    organizationName: user.organizationName,
    currentUserUuid: user.userUuid,
    currentUserOrganizationRole: role,
    currentUserRoleUuid: user.roleUuid ?? undefined,
    auditVisibility,
  };
}
