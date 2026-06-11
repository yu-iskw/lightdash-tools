import util from 'node:util';

import { describe, it, expect } from 'vitest';

import { SecretString } from './secret-string';

describe('SecretString', () => {
  const secret = new SecretString('my-secret-token');

  it('toString() masks the value', () => {
    expect(secret.toString()).toBe('**********');
    expect(String(secret)).toBe('**********');
  });

  it('toJSON() masks the value', () => {
    expect(secret.toJSON()).toBe('**********');
    expect(JSON.stringify({ token: secret })).toBe('{"token":"**********"}');
  });

  it('custom inspect masks the value', () => {
    expect(util.inspect(secret)).toBe('SecretString(**********)');
  });

  it('expose() returns the underlying value', () => {
    expect(secret.expose()).toBe('my-secret-token');
  });
});
