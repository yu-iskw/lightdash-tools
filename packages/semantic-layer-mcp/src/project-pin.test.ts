import { Command } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveCliOptions } from './cli-options.js';
import { buildMcpGovernance } from './governance.js';
import {
  clearStaticPinnedProjectUuid,
  extractPinnedProjectFromRequest,
  parsePinnedProjectUuid,
  runWithProjectPinAsync,
  setStaticPinnedProjectUuid,
} from './project-pin.js';

import type { IncomingMessage } from 'node:http';

const VALID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER = '11111111-1111-1111-1111-111111111111';

describe('project pin', () => {
  const originalEnv = process.env.LIGHTDASH_TOOLS_PINNED_PROJECT;

  afterEach(() => {
    clearStaticPinnedProjectUuid();
    if (originalEnv === undefined) {
      delete process.env.LIGHTDASH_TOOLS_PINNED_PROJECT;
    } else {
      process.env.LIGHTDASH_TOOLS_PINNED_PROJECT = originalEnv;
    }
  });

  it('accepts a valid UUID', () => {
    expect(parsePinnedProjectUuid(VALID)).toBe(VALID);
  });

  it('ignores invalid UUID values (official Lightdash MCP behavior)', () => {
    expect(parsePinnedProjectUuid('not-a-uuid')).toBeUndefined();
    expect(parsePinnedProjectUuid('')).toBeUndefined();
    expect(parsePinnedProjectUuid(undefined)).toBeUndefined();
  });

  it('extracts X-Lightdash-Project from the request', () => {
    const req = {
      headers: { 'x-lightdash-project': VALID },
    } as unknown as IncomingMessage;
    expect(extractPinnedProjectFromRequest(req)).toBe(VALID);
  });

  it('ignores invalid header values', () => {
    const req = {
      headers: { 'x-lightdash-project': 'prod' },
    } as unknown as IncomingMessage;
    expect(extractPinnedProjectFromRequest(req)).toBeUndefined();
  });

  it('reads pin from LIGHTDASH_TOOLS_PINNED_PROJECT', () => {
    process.env.LIGHTDASH_TOOLS_PINNED_PROJECT = VALID;
    expect(buildMcpGovernance().pinnedProjectUuid).toBe(VALID);
  });

  it('CLI static override beats env', () => {
    process.env.LIGHTDASH_TOOLS_PINNED_PROJECT = OTHER;
    setStaticPinnedProjectUuid(VALID);
    expect(buildMcpGovernance().pinnedProjectUuid).toBe(VALID);
  });

  it('invalid CLI pin clears env pin', () => {
    process.env.LIGHTDASH_TOOLS_PINNED_PROJECT = VALID;
    setStaticPinnedProjectUuid(undefined);
    expect(buildMcpGovernance().pinnedProjectUuid).toBeUndefined();
  });

  it('request pin wins over process pin in governance', async () => {
    setStaticPinnedProjectUuid(OTHER);
    await runWithProjectPinAsync(VALID, async () => {
      expect(buildMcpGovernance().pinnedProjectUuid).toBe(VALID);
    });
  });

  it('missing request pin falls back to process pin', async () => {
    setStaticPinnedProjectUuid(VALID);
    await runWithProjectPinAsync(undefined, async () => {
      expect(buildMcpGovernance().pinnedProjectUuid).toBe(VALID);
    });
  });
});

describe('resolveCliOptions', () => {
  it('merges pin from parent when subcommand options are empty', () => {
    const parent = new Command();
    parent.option('--pin-project <uuid>');
    parent.option('--projects <uuids>');
    parent.parse(['--pin-project', VALID, '--projects', 'a'], { from: 'user' });

    const child = parent.command('stdio');
    expect(resolveCliOptions(child, {})).toEqual({
      pinProject: VALID,
      projects: 'a',
    });
  });

  it('prefers subcommand options over parent', () => {
    const parent = new Command();
    parent.option('--pin-project <uuid>');
    parent.parse(['--pin-project', OTHER], { from: 'user' });

    const child = parent.command('stdio');
    expect(resolveCliOptions(child, { pinProject: VALID })).toEqual({
      pinProject: VALID,
      projects: undefined,
    });
  });
});
