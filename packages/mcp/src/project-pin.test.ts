import { describe, expect, it } from 'vitest';

import { buildMcpGovernance } from './governance.js';
import {
  extractPinnedProjectFromRequest,
  parsePinnedProjectUuid,
  runWithProjectPinAsync,
} from './project-pin.js';

import type { IncomingMessage } from 'node:http';

const VALID = '550e8400-e29b-41d4-a716-446655440000';

describe('project pin', () => {
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

  it('request pin sets governance.pinnedProjectUuid', async () => {
    await runWithProjectPinAsync(VALID, async () => {
      expect(buildMcpGovernance().pinnedProjectUuid).toBe(VALID);
    });
  });

  it('no request pin means undefined governance pin', () => {
    expect(buildMcpGovernance().pinnedProjectUuid).toBeUndefined();
  });
});
