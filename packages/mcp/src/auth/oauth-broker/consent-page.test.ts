import { describe, expect, it, vi } from 'vitest';

import { bindServerProfile } from '../../audit/server-profile.js';
import {
  AI_AGENT_OPS_PROFILE_PATH,
  CONTENT_DEVELOPER_PROFILE_PATH,
  PROFILES,
  SEMANTIC_LAYER_PROFILE_PATH,
} from '../../profiles/index.js';
import { registerTools } from '../../tools/registry.js';
import { TOOL_PREFIX } from '../../tools/shared.js';

import {
  displayClientName,
  escapeHtml,
  profileCapabilitiesFromResource,
  renderConsentPage,
} from './consent-page.js';

describe('consent page', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('classifies semantic-layer as non-mutating', () => {
    expect(
      profileCapabilitiesFromResource(`https://mcp.example.com${SEMANTIC_LAYER_PROFILE_PATH}`),
    ).toEqual({
      profileId: 'semantic-layer',
      canMutate: false,
      destructive: false,
      openWorld: false,
    });
  });

  it('classifies content-developer as mutating', () => {
    expect(
      profileCapabilitiesFromResource(`https://mcp.example.com${CONTENT_DEVELOPER_PROFILE_PATH}`),
    ).toMatchObject({
      profileId: 'content-developer',
      canMutate: true,
      destructive: false,
    });
  });

  it('renders unverified client name as escaped text', () => {
    const html = renderConsentPage({
      consentPath: '/oauth/consent',
      brokerState: 'state-1',
      csrfToken: 'csrf-1',
      clientId: 'abc',
      clientName: '<script>alert(1)</script>',
      resource: `https://mcp.example.com${SEMANTIC_LAYER_PROFILE_PATH}`,
    });
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Unverified');
    expect(html).toContain('name="broker_state" value="state-1"');
    expect(html).toContain('name="csrf_token" value="csrf-1"');
  });

  it('classifies ai-agent-ops as mutating, destructive, and open-world', () => {
    expect(
      profileCapabilitiesFromResource(`https://mcp.example.com${AI_AGENT_OPS_PROFILE_PATH}`),
    ).toEqual({
      profileId: 'ai-agent-ops',
      canMutate: true,
      destructive: true,
      openWorld: true,
    });
  });

  it('displays a fallback name for blank DCR client names', () => {
    expect(displayClientName('')).toBe('Unregistered MCP client');
    expect(displayClientName('   ')).toBe('Unregistered MCP client');
  });

  it.each(Object.values(PROFILES))(
    '$id consent page does not understate registered tool hints',
    (profile) => {
      const annotationsByName = new Map<
        string,
        { destructiveHint?: boolean; openWorldHint?: boolean; readOnlyHint?: boolean }
      >();
      const mockServer = {
        registerTool: vi.fn(
          (
            name: string,
            options: {
              annotations?: {
                destructiveHint?: boolean;
                openWorldHint?: boolean;
                readOnlyHint?: boolean;
              };
            },
          ) => {
            annotationsByName.set(name, options.annotations ?? {});
          },
        ),
        registerResource: vi.fn(),
      };
      const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };
      bindServerProfile(mockServer, profile.id);
      registerTools(mockServer as never, mockCtx as never, profile.tools);
      const hints = [...annotationsByName.values()];
      const caps = profileCapabilitiesFromResource(`https://mcp.example.com${profile.path}`);
      expect(caps.profileId).toBe(profile.id);
      if (hints.some((annotation) => annotation.readOnlyHint === false)) {
        expect(caps.canMutate).toBe(true);
      }
      if (hints.some((annotation) => annotation.destructiveHint === true)) {
        expect(caps.destructive).toBe(true);
      }
      if (hints.some((annotation) => annotation.openWorldHint === true)) {
        expect(caps.openWorld).toBe(true);
      }
      expect(annotationsByName.size).toBeGreaterThan(0);
      expect([...annotationsByName.keys()][0]?.startsWith(TOOL_PREFIX)).toBe(true);
    },
  );
});
