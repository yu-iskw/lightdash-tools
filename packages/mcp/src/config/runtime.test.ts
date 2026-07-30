import { SafetyMode } from '@lightdash-tools/common';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  getSafetyMode,
  getStaticSafetyMode,
  setStaticSafetyMode,
  getAllowedProjectUuids,
  setStaticAllowedProjectUuids,
  isDryRunMode,
  setDryRunMode,
  getAuditLogPath,
} from './runtime.js';

describe('config/runtime', () => {
  const envKeys = [
    'LIGHTDASH_TOOLS_SAFETY_MODE',
    'LIGHTDASH_TOOLS_ALLOWED_PROJECTS',
    'LIGHTDASH_TOOLS_DRY_RUN',
    'LIGHTDASH_TOOLS_AUDIT_LOG',
  ] as const;

  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of envKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe('getSafetyMode', () => {
    it('should return safety mode from environment', () => {
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;
      expect(getSafetyMode()).toBe(SafetyMode.WRITE_DESTRUCTIVE);
    });

    it('should default to READ_ONLY when env is unset or invalid', () => {
      expect(getSafetyMode()).toBe(SafetyMode.READ_ONLY);
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = 'bad-value';
      expect(getSafetyMode()).toBe(SafetyMode.READ_ONLY);
    });
  });

  describe('setStaticSafetyMode / getStaticSafetyMode', () => {
    it('should store and return the static safety mode', () => {
      setStaticSafetyMode(SafetyMode.READ_ONLY);
      expect(getStaticSafetyMode()).toBe(SafetyMode.READ_ONLY);

      setStaticSafetyMode(SafetyMode.WRITE_IDEMPOTENT);
      expect(getStaticSafetyMode()).toBe(SafetyMode.WRITE_IDEMPOTENT);
    });
  });

  describe('getAllowedProjectUuids', () => {
    describe('from environment', () => {
      it('should return empty array when env is unset', () => {
        expect(getAllowedProjectUuids()).toEqual([]);
      });

      it('should parse comma-separated UUIDs from env', () => {
        process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'uuid-a, uuid-b';
        expect(getAllowedProjectUuids()).toEqual(['uuid-a', 'uuid-b']);
      });
    });

    describe('static override', () => {
      it('should return static allowlist over env', () => {
        process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'env-uuid';
        setStaticAllowedProjectUuids(['static-uuid']);
        expect(getAllowedProjectUuids()).toEqual(['static-uuid']);
      });

      it('should return empty array when static allowlist is empty', () => {
        process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'env-uuid';
        setStaticAllowedProjectUuids([]);
        expect(getAllowedProjectUuids()).toEqual([]);
      });
    });
  });

  describe('isDryRunMode / setDryRunMode', () => {
    describe('from environment', () => {
      it('should return false when env is unset', () => {
        expect(isDryRunMode()).toBe(false);
      });

      it('should return true when env is 1, true, or yes', () => {
        process.env.LIGHTDASH_TOOLS_DRY_RUN = '1';
        expect(isDryRunMode()).toBe(true);

        process.env.LIGHTDASH_TOOLS_DRY_RUN = 'true';
        expect(isDryRunMode()).toBe(true);

        process.env.LIGHTDASH_TOOLS_DRY_RUN = 'yes';
        expect(isDryRunMode()).toBe(true);
      });

      it('should return false for other env values', () => {
        process.env.LIGHTDASH_TOOLS_DRY_RUN = 'false';
        expect(isDryRunMode()).toBe(false);
      });
    });

    describe('static override', () => {
      beforeEach(() => {
        process.env.LIGHTDASH_TOOLS_DRY_RUN = 'true';
      });

      it('should override env when setDryRunMode(false)', () => {
        setDryRunMode(false);
        expect(isDryRunMode()).toBe(false);
      });

      it('should return true when setDryRunMode(true)', () => {
        delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
        setDryRunMode(true);
        expect(isDryRunMode()).toBe(true);
      });
    });
  });

  describe('getAuditLogPath', () => {
    it('should return undefined when env is unset', () => {
      expect(getAuditLogPath()).toBeUndefined();
    });

    it('should return path when env is set', () => {
      process.env.LIGHTDASH_TOOLS_AUDIT_LOG = '/tmp/audit.log';
      expect(getAuditLogPath()).toBe('/tmp/audit.log');
    });

    it('should return undefined when env is empty string', () => {
      process.env.LIGHTDASH_TOOLS_AUDIT_LOG = '';
      expect(getAuditLogPath()).toBeUndefined();
    });
  });
});
