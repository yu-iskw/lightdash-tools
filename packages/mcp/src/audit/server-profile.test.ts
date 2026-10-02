import { describe, expect, it } from 'vitest';

import { bindServerProfile, getServerProfile, requireServerProfile } from './server-profile.js';

describe('server-profile', () => {
  it('bindServerProfile / getServerProfile round-trip', () => {
    const server = {};
    expect(getServerProfile(server)).toBeUndefined();
    bindServerProfile(server, 'content-developer');
    expect(getServerProfile(server)).toBe('content-developer');
  });

  it('requireServerProfile returns the bound id', () => {
    const server = {};
    bindServerProfile(server, 'content-reader');
    expect(requireServerProfile(server, 'list_spaces')).toBe('content-reader');
  });

  it('requireServerProfile throws when unbound', () => {
    const server = {};
    expect(() => requireServerProfile(server, 'list_spaces')).toThrow(/profileId is required/);
  });
});
