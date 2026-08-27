import { describe, expect, it, vi } from 'vitest';

import {
  fetchSpaceAccessValidation,
  formatSpaceAccessPreviewLine,
  warningsForAgentSpaceAccess,
  warningsFromSpaceAccessValidation,
} from './space-warnings.js';

const PROJECT = '11111111-1111-1111-1111-111111111111';
const SPACE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SPACE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UNKNOWN = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

describe('warningsForAgentSpaceAccess', () => {
  it('skips when spaceAccess is undefined or empty', async () => {
    const listSpacesInProject = vi.fn();
    const client = { listSpacesInProject };
    expect(await warningsForAgentSpaceAccess(client, PROJECT, undefined)).toEqual([]);
    expect(await warningsForAgentSpaceAccess(client, PROJECT, [])).toEqual([]);
    expect(listSpacesInProject).not.toHaveBeenCalled();
  });

  it('returns SPACES_NOT_IN_PROJECT when UUIDs are missing', async () => {
    const listSpacesInProject = vi.fn().mockResolvedValue([{ uuid: SPACE_A, name: 'Finance' }]);
    const warnings = await warningsForAgentSpaceAccess({ listSpacesInProject }, PROJECT, [
      SPACE_A,
      UNKNOWN,
    ]);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'SPACES_NOT_IN_PROJECT',
        message: expect.stringContaining(UNKNOWN),
      }),
    ]);
    expect(warnings[0]?.message).toContain('Finance');
  });

  it('returns no warning when all UUIDs match', async () => {
    const listSpacesInProject = vi.fn().mockResolvedValue([
      { uuid: SPACE_A, name: 'Finance' },
      { uuid: SPACE_B, name: 'Leadership' },
    ]);
    const warnings = await warningsForAgentSpaceAccess({ listSpacesInProject }, PROJECT, [
      SPACE_A,
      SPACE_B,
    ]);
    expect(warnings).toEqual([]);
  });

  it('returns SPACE_LIST_UNAVAILABLE when list throws', async () => {
    const listSpacesInProject = vi.fn().mockRejectedValue(new Error('upstream down'));
    const warnings = await warningsForAgentSpaceAccess({ listSpacesInProject }, PROJECT, [SPACE_A]);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'SPACE_LIST_UNAVAILABLE',
        message: expect.stringContaining('upstream down'),
      }),
    ]);
  });
});

describe('warningsFromSpaceAccessValidation', () => {
  it('derives SPACES_NOT_IN_PROJECT without upstream call', () => {
    const warnings = warningsFromSpaceAccessValidation({
      resolved: [{ uuid: SPACE_A, name: 'Finance' }],
      unknownUuids: [UNKNOWN],
    });
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'SPACES_NOT_IN_PROJECT',
        message: expect.stringContaining(UNKNOWN),
      }),
    ]);
  });
});

describe('formatSpaceAccessPreviewLine', () => {
  it('shows all spaces when skipped', () => {
    expect(formatSpaceAccessPreviewLine(undefined, { skipped: true })).toBe(
      'Space access: (all project spaces)',
    );
  });

  it('shows resolved names when all match', async () => {
    const validation = await fetchSpaceAccessValidation(
      {
        listSpacesInProject: vi.fn().mockResolvedValue([{ uuid: SPACE_A, name: 'Finance' }]),
      },
      PROJECT,
      [SPACE_A],
    );
    expect(formatSpaceAccessPreviewLine([SPACE_A], validation)).toContain('Finance');
  });
});
