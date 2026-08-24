import { describe, expect, it } from 'vitest';

import {
  CONTENT_DEVELOPER_PROFILE_PATH,
  SEMANTIC_LAYER_PROFILE_PATH,
} from '../../profiles/index.js';

import {
  escapeHtml,
  profileCapabilitiesFromResource,
  renderConsentPage,
} from './consent-page.js';

describe('consent page', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
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
});
