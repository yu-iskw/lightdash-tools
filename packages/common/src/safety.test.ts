import { describe, it, expect, afterEach } from 'vitest';
import {
  SafetyMode,
  isAllowed,
  getSafetyModeFromEnv,
  getAllowedProjectUuidsFromEnv,
  isProjectAllowed,
  areAllProjectsAllowed,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from './safety';

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
  });

  describe('getSafetyModeFromEnv', () => {
    const originalEnv = process.env.LIGHTDASH_TOOL_SAFETY_MODE;

    afterEach(() => {
      process.env.LIGHTDASH_TOOL_SAFETY_MODE = originalEnv;
    });

    it('should return READ_ONLY by default when env is not set', () => {
      delete process.env.LIGHTDASH_TOOL_SAFETY_MODE;
      expect(getSafetyModeFromEnv()).toBe(SafetyMode.READ_ONLY);
    });

    it('should return value from env when set to valid mode', () => {
      process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.WRITE_IDEMPOTENT;
      expect(getSafetyModeFromEnv()).toBe(SafetyMode.WRITE_IDEMPOTENT);
    });

    it('should return READ_ONLY when env is set to invalid value', () => {
      process.env.LIGHTDASH_TOOL_SAFETY_MODE = 'invalid-mode';
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
});
