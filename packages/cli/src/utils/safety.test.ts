import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wrapAction } from './safety';
import { READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE, SafetyMode } from '@lightdash-tools/common';
import { Command } from 'commander';

describe('CLI wrapAction', () => {
  const mockAction = vi.fn().mockResolvedValue(undefined);
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow read-only action in read-only mode', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('mode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, mockAction);
    await wrapped.call(cmd, 'arg1');

    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('should block destructive action in read-only mode', async () => {
    const cmd = new Command();
    cmd.setOptionValueWithSource('mode', SafetyMode.READ_ONLY, 'cli');

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
    cmd.setOptionValueWithSource('mode', SafetyMode.WRITE_DESTRUCTIVE, 'cli');

    const wrapped = wrapAction(WRITE_DESTRUCTIVE, mockAction);
    await wrapped.call(cmd, 'arg1');

    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
