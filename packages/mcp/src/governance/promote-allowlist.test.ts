/**
 * Unit tests for promote upstream allowlist (ADR-0008 / ADR-0017).
 */

import { ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS } from '@lightdash-tools/common';
import { afterEach, describe, expect, it } from 'vitest';

import { resetAvailableProjectsCache } from './available-projects.js';
import { ProjectScopeError } from './project-scope.js';
import {
  assertPromoteTargetsAllowlisted,
  extractPromoteDiffProjectUuids,
} from './promote-allowlist.js';

import type { DashboardPromoteDiffResults } from '@lightdash-tools/client';

const SOURCE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const UPSTREAM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function emptyDiff(): DashboardPromoteDiffResults {
  return { charts: [], dashboards: [], spaces: [] };
}

describe('promote-allowlist', () => {
  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS];
    resetAvailableProjectsCache();
  });

  describe('extractPromoteDiffProjectUuids', () => {
    it('collects unique projectUuid values from nested items', () => {
      const diff: DashboardPromoteDiffResults = {
        charts: [{ data: { projectUuid: UPSTREAM, name: 'c' } as never, action: 'create' }],
        dashboards: [
          { data: { projectUuid: UPSTREAM, name: 'd' } as never, action: 'update' },
          { data: { projectUuid: OTHER, name: 'd2' } as never, action: 'create' },
        ],
        spaces: [{ data: { projectUuid: SOURCE, name: 's' } as never, action: 'create' }],
        sqlCharts: [{ data: { projectUuid: UPSTREAM, name: 'sql' } as never, action: 'create' }],
      };
      expect(extractPromoteDiffProjectUuids(diff).sort()).toEqual([OTHER, SOURCE, UPSTREAM].sort());
    });

    it('ignores rows without projectUuid', () => {
      expect(
        extractPromoteDiffProjectUuids({
          charts: [{ data: { name: 'c' } as never, action: 'create' }],
          dashboards: [],
          spaces: [],
        }),
      ).toEqual([]);
    });
  });

  describe('assertPromoteTargetsAllowlisted', () => {
    it('is a no-op when allowlist is unrestricted', () => {
      expect(() =>
        assertPromoteTargetsAllowlisted({
          upstreamProjectUuid: UPSTREAM,
          promoteDiff: emptyDiff(),
        }),
      ).not.toThrow();
    });

    it('allows upstream that is in the allowlist', () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = `${SOURCE},${UPSTREAM}`;
      expect(() =>
        assertPromoteTargetsAllowlisted({
          upstreamProjectUuid: UPSTREAM,
          promoteDiff: emptyDiff(),
        }),
      ).not.toThrow();
    });

    it('rejects upstream outside the allowlist', () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = SOURCE;
      expect(() =>
        assertPromoteTargetsAllowlisted({
          upstreamProjectUuid: UPSTREAM,
          promoteDiff: emptyDiff(),
        }),
      ).toThrow(ProjectScopeError);
      expect(() =>
        assertPromoteTargetsAllowlisted({
          upstreamProjectUuid: UPSTREAM,
          promoteDiff: emptyDiff(),
        }),
      ).toThrow(/PROJECT_NOT_AVAILABLE|not in LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS/);
    });

    it('rejects promoteDiff projectUuid outside the allowlist', () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = SOURCE;
      expect(() =>
        assertPromoteTargetsAllowlisted({
          upstreamProjectUuid: SOURCE,
          promoteDiff: {
            charts: [{ data: { projectUuid: OTHER, name: 'c' } as never, action: 'create' }],
            dashboards: [],
            spaces: [],
          },
        }),
      ).toThrow(/not in LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS/);
    });

    it('fails closed when restricted and no target UUID is known', () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = SOURCE;
      expect(() =>
        assertPromoteTargetsAllowlisted({
          upstreamProjectUuid: undefined,
          promoteDiff: emptyDiff(),
        }),
      ).toThrow(/Cannot determine upstream project/);
    });
  });
});
