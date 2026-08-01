/**
 * Project scope unit tests (ADR-0012).
 */

import { afterEach, describe, expect, it } from 'vitest';

import { runWithProjectPinAsync } from './project-pin.js';
import {
  ENV_PROJECT_UUID,
  ProjectScopeError,
  getConfiguredProjectUuid,
  resolveProjectScope,
} from './project-scope.js';

const PIN = '11111111-1111-4111-8111-111111111111';
const CFG = '22222222-2222-4222-8222-222222222222';
const ARG = '33333333-3333-4333-8333-333333333333';

describe('project-scope', () => {
  afterEach(() => {
    delete process.env[ENV_PROJECT_UUID];
  });

  it('reads configured project UUID from env', () => {
    process.env[ENV_PROJECT_UUID] = CFG;
    expect(getConfiguredProjectUuid()).toBe(CFG);
  });

  it('prefers HTTP pin over configured and argument', async () => {
    process.env[ENV_PROJECT_UUID] = CFG;
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

  it('uses configured when no pin', () => {
    process.env[ENV_PROJECT_UUID] = CFG;
    expect(resolveProjectScope()).toEqual({
      projectUuid: CFG,
      source: 'configured',
      projectPinned: false,
    });
  });

  it('rejects argument that mismatches configured', () => {
    process.env[ENV_PROJECT_UUID] = CFG;
    expect(() => resolveProjectScope({ projectUuid: ARG })).toThrow(
      /PROJECT_SCOPE_MISMATCH|conflicts/,
    );
  });

  it('uses explicit argument when no pin or config', () => {
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
    }
  });
});
