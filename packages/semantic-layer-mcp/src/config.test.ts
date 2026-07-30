import { afterEach, describe, expect, it } from 'vitest';

import {
  clearStaticAllowedProjectUuids,
  getAllowedProjectUuids,
  setStaticAllowedProjectUuids,
} from './config.js';
import { buildMcpGovernance } from './governance.js';

describe('project allowlist governance', () => {
  const originalEnv = process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;

  afterEach(() => {
    clearStaticAllowedProjectUuids();
    if (originalEnv === undefined) {
      delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    } else {
      process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = originalEnv;
    }
  });

  it('empty env means unrestricted (empty list)', () => {
    delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    expect(getAllowedProjectUuids()).toEqual([]);
    expect(buildMcpGovernance().allowedProjectUuids).toEqual([]);
  });

  it('reads allowed projects from LIGHTDASH_TOOLS_ALLOWED_PROJECTS', () => {
    process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'proj-a, proj-b';
    expect(getAllowedProjectUuids()).toEqual(['proj-a', 'proj-b']);
  });

  it('CLI --projects override beats env', () => {
    process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS = 'from-env';
    setStaticAllowedProjectUuids(['from-cli']);
    expect(getAllowedProjectUuids()).toEqual(['from-cli']);
    expect(buildMcpGovernance().allowedProjectUuids).toEqual(['from-cli']);
  });
});
