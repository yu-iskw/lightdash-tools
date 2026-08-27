import { describe, expect, it } from 'vitest';

import {
  buildSecureCreateAiAgentBody,
  collectElevationWarnings,
  collectElevationWarningsFromPatch,
  digestCreateAgentPayload,
  normalizeAgentTags,
  resolveSecureAgentCreateFlags,
  SECURE_AGENT_CREATE_DEFAULTS,
} from './secure-create-defaults.js';

describe('resolveSecureAgentCreateFlags', () => {
  it('returns secure defaults when partial is empty', () => {
    expect(resolveSecureAgentCreateFlags({})).toEqual(SECURE_AGENT_CREATE_DEFAULTS);
  });

  it('honors explicit overrides', () => {
    expect(
      resolveSecureAgentCreateFlags({
        enableDataAccess: true,
        adminOnly: false,
      }),
    ).toEqual({
      ...SECURE_AGENT_CREATE_DEFAULTS,
      enableDataAccess: true,
      adminOnly: false,
    });
  });
});

describe('normalizeAgentTags', () => {
  it('maps empty arrays to null', () => {
    expect(normalizeAgentTags([])).toBeNull();
    expect(normalizeAgentTags(null)).toBeNull();
    expect(normalizeAgentTags(['orders'])).toEqual(['orders']);
  });
});

describe('buildSecureCreateAiAgentBody', () => {
  it('applies secure defaults and standard create scaffolding', () => {
    const body = buildSecureCreateAiAgentBody({
      name: 'Smoke',
      projectUuid: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(body).toMatchObject({
      ...SECURE_AGENT_CREATE_DEFAULTS,
      name: 'Smoke',
      integrations: [],
      imageUrl: null,
      groupAccess: [],
      userAccess: [],
      spaceAccess: [],
      version: 1,
    });
  });
});

describe('collectElevationWarnings', () => {
  it('returns no warnings for secure baseline', () => {
    expect(collectElevationWarnings({})).toEqual([]);
  });

  it('warns on elevated data access and public visibility', () => {
    const warnings = collectElevationWarnings({
      enableDataAccess: true,
      adminOnly: false,
    });
    expect(warnings.map((w) => w.code)).toEqual([
      'ELEVATED_DATA_ACCESS',
      'ELEVATED_PUBLIC_VISIBILITY',
    ]);
  });

  it('warns when content tools enabled without data access', () => {
    const warnings = collectElevationWarnings({ enableContentTools: true });
    expect(warnings.map((w) => w.code)).toContain('ELEVATED_CONTENT_TOOLS');
    expect(warnings.map((w) => w.code)).toContain('ELEVATED_CONTENT_WITHOUT_DATA');
  });

  it('warns on specific user/group visibility', () => {
    const warnings = collectElevationWarnings({
      adminOnly: false,
      userAccess: ['u1'],
      groupAccess: [],
    });
    expect(warnings).toEqual([expect.objectContaining({ code: 'ELEVATED_PUBLIC_VISIBILITY' })]);
  });
});

describe('digestCreateAgentPayload', () => {
  it('is order-stable for tags and omits empty tag lists', () => {
    const a = digestCreateAgentPayload({ name: 'A', tags: ['b', 'a'], enableDataAccess: true });
    const b = digestCreateAgentPayload({ name: 'A', tags: ['a', 'b'], enableDataAccess: true });
    expect(a).toBe(b);

    const omitted = digestCreateAgentPayload({ name: 'A' });
    const empty = digestCreateAgentPayload({ name: 'A', tags: [] });
    expect(omitted).toBe(empty);
  });
});

describe('collectElevationWarningsFromPatch', () => {
  it('returns empty when patch has no permission fields', () => {
    expect(collectElevationWarningsFromPatch({})).toEqual([]);
  });

  it('warns only when patch explicitly elevates', () => {
    const warnings = collectElevationWarningsFromPatch({ enableDataAccess: true });
    expect(warnings.map((w) => w.code)).toContain('ELEVATED_DATA_ACCESS');
  });

  it('does not warn content-without-data when patch only enables content tools', () => {
    expect(collectElevationWarningsFromPatch({ enableContentTools: true })).toEqual([
      expect.objectContaining({ code: 'ELEVATED_CONTENT_TOOLS' }),
    ]);
  });

  it('warns content-without-data when patch explicitly disables data access', () => {
    const warnings = collectElevationWarningsFromPatch({
      enableContentTools: true,
      enableDataAccess: false,
    });
    expect(warnings.map((w) => w.code)).toContain('ELEVATED_CONTENT_WITHOUT_DATA');
  });
});
