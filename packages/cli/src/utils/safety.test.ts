import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wrapAction } from './safety';
import {
  READ_ONLY_DEFAULT,
  WRITE_DESTRUCTIVE,
  WRITE_IDEMPOTENT,
  SafetyMode,
} from '@lightdash-tools/common';
import { Command } from 'commander';

describe('CLI wrapAction', () => {
  const mockAction = vi.fn().mockResolvedValue(undefined);
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIGHTDASH_DRY_RUN;
  });

  afterEach(() => {
    delete process.env.LIGHTDASH_DRY_RUN;
  });

  it('should allow read-only action in read-only mode', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, mockAction);
    await wrapped.call(cmd, 'arg1');

    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should block destructive action in read-only mode', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(WRITE_DESTRUCTIVE, mockAction);

    await expect(wrapped.call(cmd, 'arg1')).rejects.toThrow('exit');

    expect(mockAction).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('disabled in read-only mode'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should allow destructive action in write-destructive mode', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.WRITE_DESTRUCTIVE, 'cli');

    const wrapped = wrapAction(WRITE_DESTRUCTIVE, mockAction);
    await wrapped.call(cmd, 'arg1');

    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should reject invalid projectUuid in options before calling handler', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, mockAction);

    await expect(wrapped.call(cmd, 'arg1', { projectUuid: 'uuid?fields=name' })).rejects.toThrow(
      'exit',
    );

    expect(mockAction).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid resource ID'));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should allow free-form query strings in positionals', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, mockAction);

    await wrapped.call(cmd, 'what?');
    expect(mockAction).toHaveBeenCalledWith('what?');
    expect(processExitSpy).not.toHaveBeenCalled();

    mockAction.mockClear();
    await wrapped.call(cmd, 'growth%');
    expect(mockAction).toHaveBeenCalledWith('growth%');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should simulate write command when LIGHTDASH_DRY_RUN=1', async () => {
    process.env.LIGHTDASH_DRY_RUN = '1';
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.WRITE_IDEMPOTENT, 'cli');

    const wrapped = wrapAction(WRITE_IDEMPOTENT, mockAction);
    await wrapped.call(cmd, 'project-uuid-123');

    expect(mockAction).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN] Would execute'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No changes were made'));
  });

  it('should execute read command even when LIGHTDASH_DRY_RUN=1', async () => {
    process.env.LIGHTDASH_DRY_RUN = '1';
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, mockAction);
    await wrapped.call(cmd, 'arg1');

    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN]'));
  });
});
