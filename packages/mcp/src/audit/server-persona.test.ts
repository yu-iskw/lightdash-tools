import { describe, expect, it } from 'vitest';

import { bindServerPersona, getServerPersona, requireServerPersona } from './server-persona.js';

describe('server-persona', () => {
  it('bindServerPersona / getServerPersona round-trip', () => {
    const server = {};
    expect(getServerPersona(server)).toBeUndefined();
    bindServerPersona(server, 'content-developer');
    expect(getServerPersona(server)).toBe('content-developer');
  });

  it('requireServerPersona returns the bound id', () => {
    const server = {};
    bindServerPersona(server, 'content-reader');
    expect(requireServerPersona(server, 'list_spaces')).toBe('content-reader');
  });

  it('requireServerPersona throws when unbound', () => {
    expect(() => requireServerPersona({}, 'list_spaces')).toThrow(
      'personaId is required to register list_spaces',
    );
  });
});
