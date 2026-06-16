import { describe, expect, it } from 'vitest';

import {
  LIGHTDASH_ALLOW_API_KEY_AUTH_ORDER,
  LIGHTDASH_GET_AUTHENTICATED_USER_MIDDLEWARE,
  LIGHTDASH_OAUTH_UPSTREAM_REFERENCES,
  LIGHTDASH_OAUTH_VALIDATION_ENDPOINT,
} from './lightdash-oauth-upstream-contract.js';

import type { LightdashApi } from '@lightdash-tools/common';

describe('Lightdash OAuth upstream contract', () => {
  it('documents GET /api/v1/user as the validation endpoint with allowApiKeyAuthentication', () => {
    expect(LIGHTDASH_OAUTH_VALIDATION_ENDPOINT).toBe('/api/v1/user');
    expect(LIGHTDASH_GET_AUTHENTICATED_USER_MIDDLEWARE).toEqual([
      'allowApiKeyAuthentication',
      'isAuthenticated',
    ]);
    expect(LIGHTDASH_ALLOW_API_KEY_AUTH_ORDER[0]).toBe('oauth-bearer');
    expect(LIGHTDASH_OAUTH_UPSTREAM_REFERENCES.length).toBeGreaterThanOrEqual(2);
    expect(LIGHTDASH_OAUTH_UPSTREAM_REFERENCES.join(' ')).toContain('userController.ts');
    expect(LIGHTDASH_OAUTH_UPSTREAM_REFERENCES.join(' ')).toContain('middlewares.ts');
  });

  it('expects AuthenticatedUser to expose optional organizationUuid for session binding', () => {
    const user = {
      userUuid: 'user-uuid',
      firstName: 'Test',
      lastName: 'User',
      userId: 1,
      isTrackingAnonymized: false,
      isMarketingOptedIn: false,
      isSetupComplete: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      timezone: null,
      organizationUuid: 'org-uuid',
      impersonation: null,
    } satisfies LightdashApi.Users.AuthenticatedUser;

    expect(user.organizationUuid).toBe('org-uuid');
  });

  it('allows AuthenticatedUser without organizationUuid (org binding falls back to subject only)', () => {
    type UserWithoutOrg = Omit<LightdashApi.Users.AuthenticatedUser, 'organizationUuid'> & {
      organizationUuid?: undefined;
    };
    const user: UserWithoutOrg = {
      userUuid: 'user-uuid',
      firstName: 'Test',
      lastName: 'User',
      userId: 1,
      isTrackingAnonymized: false,
      isMarketingOptedIn: false,
      isSetupComplete: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      timezone: null,
      impersonation: null,
    };

    expect(user.organizationUuid).toBeUndefined();
  });
});
