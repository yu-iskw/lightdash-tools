import {
  READ_ONLY_DEFAULT,
  WRITE_DESTRUCTIVE,
  WRITE_IDEMPOTENT,
  SafetyMode,
} from '@lightdash-tools/common';
import { Command } from 'commander';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  assertAllowedProject,
  getAllowedProjects,
  getSafetyMode,
  isDryRun,
  wrapAction,
} from './safety';

const UUID_ALLOWED = '11111111-1111-1111-1111-111111111111';
const UUID_FORBIDDEN = '22222222-2222-2222-2222-222222222222';

/** Builds a root + subcommand hierarchy like the real CLI program. */
function buildCommandHierarchy(): { root: Command; child: Command } {
  const root = new Command('lightdash-ai');
  root
    .option('--safety-mode <mode>', 'Safety mode')
    .option('--projects <uuids>', 'Allowed project UUIDs')
    .option('--dry-run', 'Simulate mutating operations');
  const child = new Command('charts');
  root.addCommand(child);
  return { root, child };
}

describe('getSafetyMode', () => {
  afterEach(() => {
    delete process.env.LIGHTDASH_TOOLS_SAFETY_MODE;
  });

  it('reads safety mode from cmd option via optsWithGlobals', () => {
    const { child } = buildCommandHierarchy();
    child.setOptionValueWithSource('safetyMode', SafetyMode.WRITE_DESTRUCTIVE, 'cli');

    expect(getSafetyMode(child)).toBe(SafetyMode.WRITE_DESTRUCTIVE);
  });
});

describe('isDryRun', () => {
  beforeEach(() => {
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
  });

  afterEach(() => {
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
  });

  it('reads dry-run from root --dry-run flag', () => {
    const { root, child } = buildCommandHierarchy();
    root.setOptionValueWithSource('dryRun', true, 'cli');

    expect(isDryRun(child)).toBe(true);
  });
});

describe('getAllowedProjects', () => {
  it('reads comma-separated projects from root --projects flag', () => {
    const { root, child } = buildCommandHierarchy();
    root.setOptionValueWithSource('projects', `${UUID_ALLOWED}, ${UUID_FORBIDDEN}`, 'cli');

    expect(getAllowedProjects(child)).toEqual([UUID_ALLOWED, UUID_FORBIDDEN]);
  });
});

describe('assertAllowedProject', () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows project when no allowlist is configured', () => {
    const { child } = buildCommandHierarchy();
    expect(() => assertAllowedProject(child, UUID_FORBIDDEN)).not.toThrow();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('allows project when it is in the allowlist', () => {
    const { root, child } = buildCommandHierarchy();
    root.setOptionValueWithSource('projects', UUID_ALLOWED, 'cli');
    expect(() => assertAllowedProject(child, UUID_ALLOWED)).not.toThrow();
    expect(processExitSpy).not.toHaveBeenCalled();
  });

  it('blocks project parsed from bundle when not in allowlist', () => {
    const { root, child } = buildCommandHierarchy();
    root.setOptionValueWithSource('projects', UUID_ALLOWED, 'cli');

    expect(() => assertAllowedProject(child, UUID_FORBIDDEN)).toThrow('exit');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('not in the list of allowed projects'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});

describe('CLI wrapAction', () => {
  const mockAction = vi.fn().mockResolvedValue(undefined);
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('exit');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
  });

  afterEach(() => {
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
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

  it('should simulate write command when LIGHTDASH_TOOLS_DRY_RUN=1', async () => {
    process.env.LIGHTDASH_TOOLS_DRY_RUN = '1';
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.WRITE_IDEMPOTENT, 'cli');

    const wrapped = wrapAction(WRITE_IDEMPOTENT, mockAction);
    await wrapped.call(cmd, 'project-uuid-123');

    expect(mockAction).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN] Would execute'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('No changes were made'));
  });

  it('should execute read command even when LIGHTDASH_TOOLS_DRY_RUN=1', async () => {
    process.env.LIGHTDASH_TOOLS_DRY_RUN = '1';
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, mockAction);
    await wrapped.call(cmd, 'arg1');

    expect(mockAction).toHaveBeenCalledWith('arg1');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN]'));
  });

  it('should simulate write command when root --dry-run flag is set', async () => {
    const { root, child } = buildCommandHierarchy();
    child.setOptionValueWithSource('safetyMode', SafetyMode.WRITE_IDEMPOTENT, 'cli');
    root.setOptionValueWithSource('dryRun', true, 'cli');

    const wrapped = wrapAction(WRITE_IDEMPOTENT, mockAction);
    await wrapped.call(child, UUID_ALLOWED);

    expect(mockAction).not.toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('[DRY-RUN] Would execute'));
  });

  it('should block when project is not in root --projects list', async () => {
    const { root, child } = buildCommandHierarchy();
    child.setOptionValueWithSource('safetyMode', SafetyMode.WRITE_DESTRUCTIVE, 'cli');
    root.setOptionValueWithSource('projects', UUID_ALLOWED, 'cli');

    const wrapped = wrapAction(WRITE_IDEMPOTENT, mockAction);

    await expect(wrapped.call(child, UUID_FORBIDDEN)).rejects.toThrow('exit');

    expect(mockAction).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('not in the list of allowed projects'),
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it('should re-throw when the action throws', async () => {
    const failingAction = vi.fn().mockRejectedValue(new Error('action failed'));
    const cmd = new Command();
    cmd.setOptionValueWithSource('safetyMode', SafetyMode.READ_ONLY, 'cli');

    const wrapped = wrapAction(READ_ONLY_DEFAULT, failingAction);

    await expect(wrapped.call(cmd, 'arg1')).rejects.toThrow('action failed');

    expect(failingAction).toHaveBeenCalledWith('arg1');
    expect(processExitSpy).not.toHaveBeenCalled();
  });
});
