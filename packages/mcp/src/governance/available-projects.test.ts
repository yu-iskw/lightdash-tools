/**
 * Shared project allowlist unit tests.
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS } from '@lightdash-tools/common';
import { afterEach, describe, expect, it } from 'vitest';

import {
  AvailableProjectsConfigError,
  filterProjectsByAvailability,
  findUnavailableProjectUuids,
  getAvailableProjectsPolicy,
  isProjectAvailable,
  resetAvailableProjectsCache,
  resolveSearchProjectUuids,
  validateAvailableProjectsConfig,
} from './available-projects.js';

const UUID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UUID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const UUID_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const UUID_A_UPPER = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';

function uuidsFromPolicy(env: NodeJS.ProcessEnv): string[] {
  const policy = getAvailableProjectsPolicy(env);
  return policy.restricted ? [...policy.list] : [];
}

describe('available-projects', () => {
  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS];
    delete process.env.LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS;
    resetAvailableProjectsCache();
  });

  describe('getAvailableProjectsPolicy', () => {
    it('returns unrestricted when unset', () => {
      expect(getAvailableProjectsPolicy({})).toEqual({ restricted: false });
    });

    it('parses ALLOWED_PROJECTS with lowercasing', () => {
      expect(
        uuidsFromPolicy({
          [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: ` ${UUID_A_UPPER} , ${UUID_B} `,
        }),
      ).toEqual([UUID_A, UUID_B]);
    });

    it('rejects empty segments', () => {
      expect(() =>
        getAvailableProjectsPolicy({ [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: ',,,' }),
      ).toThrow(/empty segments/);
    });

    it('ignores removed MCP_AVAILABLE env when reading policy (validate catches it)', () => {
      expect(
        uuidsFromPolicy({
          LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS: UUID_A,
        }),
      ).toEqual([]);
    });
  });

  describe('isProjectAvailable', () => {
    it('allows any UUID when unrestricted', () => {
      expect(isProjectAvailable(UUID_A, {})).toBe(true);
    });

    it('allows members case-insensitively', () => {
      const env = { [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: `${UUID_A},${UUID_B}` };
      expect(isProjectAvailable(UUID_A_UPPER, env)).toBe(true);
      expect(isProjectAvailable(UUID_C, env)).toBe(false);
    });
  });

  describe('findUnavailableProjectUuids / filter', () => {
    it('returns unavailable UUIDs', () => {
      const env = { [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: `${UUID_A},${UUID_B}` };
      expect(findUnavailableProjectUuids([UUID_A, UUID_C], env)).toEqual([UUID_C]);
    });

    it('filters projects', () => {
      const env = { [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: UUID_A };
      const projects = [
        { projectUuid: UUID_A, name: 'a' },
        { projectUuid: UUID_C, name: 'c' },
      ];
      expect(filterProjectsByAvailability(projects, env)).toEqual([
        { projectUuid: UUID_A, name: 'a' },
      ]);
    });

    it('returns the same array reference when unrestricted', () => {
      const projects = [{ projectUuid: UUID_A, name: 'a' }];
      expect(filterProjectsByAvailability(projects, {})).toBe(projects);
    });
  });

  describe('resolveSearchProjectUuids', () => {
    it('defaults to allowlist when restricted', () => {
      const env = { [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: `${UUID_A},${UUID_B}` };
      expect(resolveSearchProjectUuids({}, env)).toEqual([UUID_A, UUID_B]);
    });

    it('returns undefined when unrestricted', () => {
      expect(resolveSearchProjectUuids({}, {})).toBeUndefined();
    });
  });

  describe('validateAvailableProjectsConfig', () => {
    it('accepts valid allowlist', () => {
      expect(() =>
        validateAvailableProjectsConfig({
          [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: `${UUID_A},${UUID_B}`,
        }),
      ).not.toThrow();
    });

    it('rejects invalid UUID', () => {
      expect(() =>
        validateAvailableProjectsConfig({ [ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECTS]: 'bad' }),
      ).toThrow(AvailableProjectsConfigError);
    });

    it('rejects removed MCP_AVAILABLE env', () => {
      expect(() =>
        validateAvailableProjectsConfig({
          LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS: UUID_A,
        }),
      ).toThrow(/no longer supported/);
      expect(() =>
        validateAvailableProjectsConfig({
          LIGHTDASH_TOOLS_MCP_AVAILABLE_PROJECT_UUIDS: UUID_A,
        }),
      ).toThrow(/LIGHTDASH_TOOLS_ALLOWED_PROJECTS/);
    });
  });
});
