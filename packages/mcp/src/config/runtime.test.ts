import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { getAuditLogPath, warnIgnoredCliGuardrailEnvVars } from './runtime.js';

describe('config/runtime', () => {
  const originalAuditLog = process.env.LIGHTDASH_TOOLS_AUDIT_LOG;
  const originalSafety = process.env.LIGHTDASH_TOOLS_SAFETY_MODE;
  const originalAllowlist = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
  const originalDryRun = process.env.LIGHTDASH_TOOLS_DRY_RUN;

  beforeEach(() => {
    delete process.env.LIGHTDASH_TOOLS_AUDIT_LOG;
    delete process.env.LIGHTDASH_TOOLS_SAFETY_MODE;
    delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
  });

  afterEach(() => {
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    };
    restore('LIGHTDASH_TOOLS_AUDIT_LOG', originalAuditLog);
    restore('LIGHTDASH_TOOLS_SAFETY_MODE', originalSafety);
    restore('LIGHTDASH_TOOLS_ALLOWED_PROJECTS', originalAllowlist);
    restore('LIGHTDASH_TOOLS_DRY_RUN', originalDryRun);
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

  describe('warnIgnoredCliGuardrailEnvVars', () => {
    it('does not warn when CLI guardrail env vars are unset', () => {
      const warn = vi.fn();
      warnIgnoredCliGuardrailEnvVars(process.env, warn);
      expect(warn).not.toHaveBeenCalled();
    });

    it('warns when SAFETY_MODE is set', () => {
      const warn = vi.fn();
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = 'read-only';
      warnIgnoredCliGuardrailEnvVars(process.env, warn);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('LIGHTDASH_TOOLS_SAFETY_MODE'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('ignored by MCP'));
    });

    it('lists all set CLI-only vars in one warning', () => {
      const warn = vi.fn();
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = 'read-only';
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'uuid';
      process.env.LIGHTDASH_TOOLS_DRY_RUN = '1';
      warnIgnoredCliGuardrailEnvVars(process.env, warn);
      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain('LIGHTDASH_TOOLS_SAFETY_MODE');
      expect(message).toContain('LIGHTDASH_TOOLS_ALLOWED_PROJECTS');
      expect(message).toContain('LIGHTDASH_TOOLS_DRY_RUN');
    });
  });
});
