import { describe, it, expect, afterEach } from 'vitest';

import {
  SafetyMode,
  isAllowed,
  getSafetyModeFromEnv,
  getAllowedProjectUuidsFromEnv,
  isProjectAllowed,
  areAllProjectsAllowed,
  extractProjectUuids,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from './safety';

const UUID_A = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';
const UUID_C = '33333333-3333-3333-3333-333333333333';

describe('Safety Logic', () => {
  describe('isAllowed', () => {
    it('should allow read-only operations in read-only mode', () => {
      expect(isAllowed(SafetyMode.READ_ONLY, READ_ONLY_DEFAULT)).toBe(true);
    });

    it('should forbid non-read-only operations in read-only mode', () => {
      expect(isAllowed(SafetyMode.READ_ONLY, WRITE_IDEMPOTENT)).toBe(false);
      expect(isAllowed(SafetyMode.READ_ONLY, WRITE_DESTRUCTIVE)).toBe(false);
    });

    it('should allow read-only and idempotent-write in write-idempotent mode', () => {
      expect(isAllowed(SafetyMode.WRITE_IDEMPOTENT, READ_ONLY_DEFAULT)).toBe(true);
      expect(isAllowed(SafetyMode.WRITE_IDEMPOTENT, WRITE_IDEMPOTENT)).toBe(true);
    });

    it('should forbid destructive operations in write-idempotent mode', () => {
      expect(isAllowed(SafetyMode.WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE)).toBe(false);
    });

    it('should allow all operations in write-destructive mode', () => {
      expect(isAllowed(SafetyMode.WRITE_DESTRUCTIVE, READ_ONLY_DEFAULT)).toBe(true);
      expect(isAllowed(SafetyMode.WRITE_DESTRUCTIVE, WRITE_IDEMPOTENT)).toBe(true);
      expect(isAllowed(SafetyMode.WRITE_DESTRUCTIVE, WRITE_DESTRUCTIVE)).toBe(true);
    });

    it('should default to permissive for an unknown mode string', () => {
      expect(isAllowed('custom-mode', WRITE_DESTRUCTIVE)).toBe(true);
    });
  });

  describe('getSafetyModeFromEnv', () => {
    const originalEnv = process.env.LIGHTDASH_TOOLS_SAFETY_MODE;

    afterEach(() => {
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = originalEnv;
    });

    it('should return READ_ONLY by default when env is not set', () => {
      delete process.env.LIGHTDASH_TOOLS_SAFETY_MODE;
      expect(getSafetyModeFromEnv()).toBe(SafetyMode.READ_ONLY);
    });

    it('should return value from env when set to valid mode', () => {
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_IDEMPOTENT;
      expect(getSafetyModeFromEnv()).toBe(SafetyMode.WRITE_IDEMPOTENT);
    });

    it('should return READ_ONLY when env is set to invalid value', () => {
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = 'invalid-mode';
      expect(getSafetyModeFromEnv()).toBe(SafetyMode.READ_ONLY);
    });
  });

  describe('getAllowedProjectUuidsFromEnv', () => {
    const originalEnv = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;

    afterEach(() => {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = originalEnv;
    });

    it('should return empty array when env is not set', () => {
      delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
      expect(getAllowedProjectUuidsFromEnv()).toEqual([]);
    });

    it('should parse a single UUID', () => {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'uuid-a';
      expect(getAllowedProjectUuidsFromEnv()).toEqual(['uuid-a']);
    });

    it('should parse comma-separated UUIDs', () => {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'uuid-a,uuid-b,uuid-c';
      expect(getAllowedProjectUuidsFromEnv()).toEqual(['uuid-a', 'uuid-b', 'uuid-c']);
    });

    it('should trim whitespace around UUIDs', () => {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = ' uuid-a , uuid-b ';
      expect(getAllowedProjectUuidsFromEnv()).toEqual(['uuid-a', 'uuid-b']);
    });

    it('should filter out empty entries', () => {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'uuid-a,,uuid-b';
      expect(getAllowedProjectUuidsFromEnv()).toEqual(['uuid-a', 'uuid-b']);
    });
  });

  describe('isProjectAllowed', () => {
    it('should allow all projects when allowlist is empty', () => {
      expect(isProjectAllowed([], 'any-uuid')).toBe(true);
    });

    it('should allow a project that is in the allowlist', () => {
      expect(isProjectAllowed(['uuid-a', 'uuid-b'], 'uuid-a')).toBe(true);
    });

    it('should deny a project that is not in the allowlist', () => {
      expect(isProjectAllowed(['uuid-a', 'uuid-b'], 'uuid-c')).toBe(false);
    });
  });

  describe('areAllProjectsAllowed', () => {
    it('should allow everything when allowlist is empty', () => {
      expect(areAllProjectsAllowed([], ['uuid-a', 'uuid-b'])).toBe(true);
    });

    it('should allow an empty projectUuids array (trivially)', () => {
      expect(areAllProjectsAllowed(['uuid-a'], [])).toBe(true);
    });

    it('should allow when all UUIDs are in the allowlist', () => {
      expect(areAllProjectsAllowed(['uuid-a', 'uuid-b'], ['uuid-a', 'uuid-b'])).toBe(true);
    });

    it('should deny when any UUID is not in the allowlist', () => {
      expect(areAllProjectsAllowed(['uuid-a', 'uuid-b'], ['uuid-a', 'uuid-c'])).toBe(false);
    });

    it('should deny when all UUIDs are outside the allowlist', () => {
      expect(areAllProjectsAllowed(['uuid-a'], ['uuid-b', 'uuid-c'])).toBe(false);
    });
  });

  describe('extractProjectUuids', () => {
    it('should return empty array for null', () => {
      expect(extractProjectUuids(null)).toEqual([]);
    });

    it('should return empty array for undefined', () => {
      expect(extractProjectUuids(undefined)).toEqual([]);
    });

    it('should extract projectUuid from MCP-style object', () => {
      expect(extractProjectUuids({ projectUuid: UUID_A })).toEqual([UUID_A]);
    });

    it('should extract projectUuids array from MCP-style object', () => {
      expect(extractProjectUuids({ projectUuids: [UUID_A, UUID_B] })).toEqual([UUID_A, UUID_B]);
    });

    it('should extract project from MCP-style object', () => {
      expect(extractProjectUuids({ project: UUID_A })).toEqual([UUID_A]);
    });

    it('should extract UUID from CLI positional argument', () => {
      expect(extractProjectUuids([UUID_A])).toEqual([UUID_A]);
    });

    it('should ignore non-UUID CLI positional strings', () => {
      expect(extractProjectUuids(['not-a-uuid', 'also-invalid'])).toEqual([]);
    });

    it('should extract from nested CLI options with projects key', () => {
      expect(extractProjectUuids([{ projects: [UUID_A, UUID_B] }])).toEqual([UUID_A, UUID_B]);
    });

    it('should extract from nested CLI options with project key', () => {
      expect(extractProjectUuids([{ project: UUID_A }])).toEqual([UUID_A]);
    });

    it('should extract from nested CLI options with projectUuid key', () => {
      expect(extractProjectUuids([{ projectUuid: UUID_A }])).toEqual([UUID_A]);
    });

    it('should extract from nested CLI options with projectUuids key', () => {
      expect(extractProjectUuids([{ projectUuids: [UUID_A, UUID_B] }])).toEqual([UUID_A, UUID_B]);
    });

    it('should combine positional UUIDs and nested option values', () => {
      expect(extractProjectUuids([UUID_A, { project: UUID_B }])).toEqual([UUID_A, UUID_B]);
    });

    it('should deduplicate UUIDs across sources', () => {
      expect(
        extractProjectUuids([
          UUID_A,
          { projectUuid: UUID_A, projectUuids: [UUID_B, UUID_C] },
          { projects: [UUID_B, UUID_C] },
        ]),
      ).toEqual([UUID_A, UUID_B, UUID_C]);
    });

    it('should filter out empty strings from extracted values', () => {
      expect(
        extractProjectUuids({
          projectUuid: '',
          projectUuids: [UUID_A, '', UUID_B],
        }),
      ).toEqual([UUID_A, UUID_B]);
    });

    it('should filter empty strings from nested CLI options', () => {
      expect(extractProjectUuids([{ projects: ['', UUID_A, ''] }])).toEqual([UUID_A]);
    });

    it('should return empty array for MCP object with no project keys', () => {
      expect(extractProjectUuids({ query: 'test', limit: 10 })).toEqual([]);
    });

    it('should return empty array for empty CLI argument array', () => {
      expect(extractProjectUuids([])).toEqual([]);
    });
  });
});
