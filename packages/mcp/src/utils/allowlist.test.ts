import { afterEach, describe, expect, it } from 'vitest';

import { setStaticAllowedProjectUuids } from '../config.js';

import { blockIfProjectNotAllowed } from './allowlist.js';

const ALLOWED = '11111111-1111-1111-1111-111111111111';
const FORBIDDEN = '22222222-2222-2222-2222-222222222222';

describe('blockIfProjectNotAllowed', () => {
  afterEach(() => {
    setStaticAllowedProjectUuids([]);
  });

  it('returns undefined when no allowlist is configured', () => {
    expect(blockIfProjectNotAllowed(FORBIDDEN)).toBeUndefined();
  });

  it('returns undefined when project is allowed', () => {
    setStaticAllowedProjectUuids([ALLOWED]);
    expect(blockIfProjectNotAllowed(ALLOWED)).toBeUndefined();
  });

  it('returns blocked response when project is not allowed', () => {
    setStaticAllowedProjectUuids([ALLOWED]);
    const blocked = blockIfProjectNotAllowed(FORBIDDEN);
    expect(blocked?.isError).toBe(true);
    expect(blocked?.content[0]?.text).toContain(FORBIDDEN);
    expect(blocked?.content[0]?.text).toContain('not in the list of allowed projects');
  });
});
