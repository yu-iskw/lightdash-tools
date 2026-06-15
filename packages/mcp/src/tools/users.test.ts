import { SafetyMode } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { TOOL_PREFIX } from './shared.js';
import { registerUserTools } from './users.js';

import type { McpContextProvider } from '../request-context.js';

describe('registerUserTools', () => {
  it('registers get_authenticated_user and returns redacted user fields', async () => {
    const handlers = new Map<string, (args: unknown) => Promise<unknown>>();
    const mockServer = {
      registerTool: vi.fn(
        (name: string, _options: unknown, handler: (args: unknown) => Promise<unknown>) => {
          handlers.set(name, handler);
        },
      ),
    };

    const mockUser = {
      userUuid: 'user-uuid-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      organizationUuid: 'org-uuid-1',
      role: 'admin',
      personalAccessToken: 'ldpat_secret',
    };

    const contextProvider: McpContextProvider = {
      getContext: async () => ({
        lightdashClient: {
          v1: {
            users: {
              getAuthenticatedUser: async () => mockUser,
            },
          },
        } as never,
        auth: { mode: 'env' },
        governance: {
          safetyMode: SafetyMode.READ_ONLY,
          dryRun: false,
          allowedProjectUuids: [],
        },
      }),
    };

    registerUserTools(mockServer as never, contextProvider);

    const handler = handlers.get(`${TOOL_PREFIX}get_authenticated_user`);
    expect(handler).toBeDefined();

    const result = await handler!({});
    const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? '';
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed).toEqual({
      userUuid: 'user-uuid-1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      organizationUuid: 'org-uuid-1',
      role: 'admin',
    });
    expect(text).not.toContain('ldpat_secret');
    expect(text).not.toContain('token');
    expect(text).not.toContain('Authorization');
  });
});
