import { SafetyMode } from '@lightdash-tools/common';
import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addGuardrailOptions,
  applyGuardrailOptions,
  resolveGuardrailOptions,
} from './cli-guardrails.js';
import { getStaticSafetyMode, setStaticSafetyMode } from './config/runtime.js';

describe('resolveGuardrailOptions', () => {
  it('prefers subcommand safety-mode over parent safety-mode', () => {
    const parent = {
      opts: () => ({ safetyMode: 'read-only' }),
    } as unknown as Command;

    const command = {
      parent,
      opts: () => ({}),
    } as unknown as Command;

    expect(
      resolveGuardrailOptions(command, {
        safetyMode: 'write-destructive',
      }),
    ).toEqual({
      safetyMode: 'write-destructive',
      projects: undefined,
      dryRun: undefined,
    });
  });

  it('falls back to parent options when subcommand omits them', () => {
    const parent = {
      opts: () => ({ safetyMode: 'read-only', dryRun: true }),
    } as unknown as Command;

    const command = {
      parent,
      opts: () => ({}),
    } as unknown as Command;

    expect(resolveGuardrailOptions(command)).toEqual({
      safetyMode: 'read-only',
      projects: undefined,
      dryRun: true,
    });
  });
});

describe('applyGuardrailOptions', () => {
  const originalExit = process.exit;

  beforeEach(() => {
    setStaticSafetyMode(SafetyMode.READ_ONLY);
  });

  afterEach(() => {
    process.exit = originalExit;
    setStaticSafetyMode(SafetyMode.READ_ONLY);
    vi.restoreAllMocks();
  });

  it('sets static safety mode for valid values', () => {
    applyGuardrailOptions({ safetyMode: 'write-destructive' });
    expect(getStaticSafetyMode()).toBe(SafetyMode.WRITE_DESTRUCTIVE);
  });

  it('exits on invalid safety mode', () => {
    const exit = vi.fn(() => {
      throw new Error('exit');
    });
    process.exit = exit as never;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => applyGuardrailOptions({ safetyMode: 'not-a-mode' })).toThrow('exit');
    expect(exit).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith('Invalid safety mode: not-a-mode');
  });
});

describe('addGuardrailOptions', () => {
  it('registers guardrail flags on subcommands', () => {
    const command = addGuardrailOptions(new Command('serve-http'));
    const help = command.helpInformation();
    expect(help).toContain('--safety-mode');
    expect(help).toContain('--projects');
    expect(help).toContain('--dry-run');
  });
});
