/**
 * Project scope unit tests (ADR-0008 / ADR-0012).
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS } from '@lightdash-tools/common';
import { afterEach, describe, expect, it } from 'vitest';

import { resetAvailableProjectsCache } from './available-projects.js';
import { runWithProjectPinAsync } from './project-pin.js';
import { ProjectScopeError, resolveProjectScope } from './project-scope.js';

const PIN = '11111111-1111-4111-8111-111111111111';
const ARG = '33333333-3333-4333-8333-333333333333';
const OTHER = '22222222-2222-4222-8222-222222222222';

describe('project-scope', () => {
  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS];
    delete process.env.LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS;
    resetAvailableProjectsCache();
  });

  it('prefers HTTP pin over argument', async () => {
    await runWithProjectPinAsync(PIN, async () => {
      expect(resolveProjectScope({ projectUuid: PIN })).toEqual({
        projectUuid: PIN,
        source: 'pin',
        projectPinned: true,
      });
    });
  });

  it('rejects argument that mismatches pin', async () => {
    await runWithProjectPinAsync(PIN, async () => {
      expect(() => resolveProjectScope({ projectUuid: ARG })).toThrow(ProjectScopeError);
      try {
        resolveProjectScope({ projectUuid: ARG });
      } catch (err) {
        expect(err).toBeInstanceOf(ProjectScopeError);
        expect((err as ProjectScopeError).code).toBe('PROJECT_SCOPE_MISMATCH');
      }
    });
  });

  it('uses explicit argument when no pin', () => {
    expect(resolveProjectScope({ projectUuid: ARG })).toEqual({
      projectUuid: ARG,
      source: 'argument',
      projectPinned: false,
    });
  });

  it('throws PROJECT_SCOPE_REQUIRED when nothing resolves', () => {
    expect(() => resolveProjectScope()).toThrow(ProjectScopeError);
    try {
      resolveProjectScope();
    } catch (err) {
      expect((err as ProjectScopeError).code).toBe('PROJECT_SCOPE_REQUIRED');
      expect((err as ProjectScopeError).message).not.toContain('LIGHTDASH_TOOLS_PROJECT_UUID');
    }
  });

  describe('shared allowlist', () => {
    it('allows resolved UUID inside the allowlist', () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS] = `${ARG},${OTHER}`;
      resetAvailableProjectsCache();
      expect(resolveProjectScope({ projectUuid: ARG })).toEqual({
        projectUuid: ARG,
        source: 'argument',
        projectPinned: false,
      });
    });

    it('rejects resolved UUID outside the allowlist', () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS] = OTHER;
      resetAvailableProjectsCache();
      expect(() => resolveProjectScope({ projectUuid: ARG })).toThrow(ProjectScopeError);
      try {
        resolveProjectScope({ projectUuid: ARG });
      } catch (err) {
        expect((err as ProjectScopeError).code).toBe('PROJECT_NOT_AVAILABLE');
      }
    });
  });
});
