import { SafetyMode } from '@lightdash-tools/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { setStaticAllowedProjectUuids } from '../config/runtime.js';
import { runWithProjectPinAsync } from '../project-pin.js';

import { registerListProjects } from './projects.js';

import type { McpContextProvider } from '../request-context.js';

const PINNED = '550e8400-e29b-41d4-a716-446655440000';
const OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function mockContext(
  listProjects: ReturnType<typeof vi.fn>,
  getProject: ReturnType<typeof vi.fn>,
  pinnedProjectUuid?: string,
): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {
        v1: { projects: { listProjects, getProject } },
      },
      auth: { mode: 'none' as const },
      governance: {
        safetyMode: SafetyMode.WRITE_DESTRUCTIVE,
        dryRun: false,
        allowedProjectUuids: [],
        pinnedProjectUuid,
      },
    }),
  } as unknown as McpContextProvider;
}

describe('registerListProjects', () => {
  afterEach(() => {
    setStaticAllowedProjectUuids([]);
  });

  it('returns only the pinned project when X-Lightdash-Project ALS is set', async () => {
    const pinnedProject = { projectUuid: PINNED, name: 'Pinned' };
    const listProjects = vi
      .fn()
      .mockResolvedValue([pinnedProject, { projectUuid: OTHER, name: 'Other' }]);
    const getProject = vi.fn().mockResolvedValue(pinnedProject);

    const mockServer = { registerTool: vi.fn() };
    registerListProjects(mockServer as never, mockContext(listProjects, getProject, PINNED));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    await runWithProjectPinAsync(PINNED, async () => {
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(JSON.parse(result.content[0].text)).toEqual([pinnedProject]);
      expect(getProject).toHaveBeenCalledWith(PINNED);
      expect(listProjects).not.toHaveBeenCalled();
    });
  });

  it('blocks pinned list_projects when pin is outside the allowlist', async () => {
    setStaticAllowedProjectUuids([OTHER]);
    const getProject = vi.fn();
    const listProjects = vi.fn();

    const mockServer = { registerTool: vi.fn() };
    registerListProjects(mockServer as never, mockContext(listProjects, getProject, PINNED));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    await runWithProjectPinAsync(PINNED, async () => {
      const result = await handler({});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not in the list of allowed projects');
      expect(result.content[0].text).toContain(PINNED);
      expect(getProject).not.toHaveBeenCalled();
    });
  });

  it('lists all projects when no pin is set', async () => {
    const all = [
      { projectUuid: PINNED, name: 'A' },
      { projectUuid: OTHER, name: 'B' },
    ];
    const listProjects = vi.fn().mockResolvedValue(all);
    const getProject = vi.fn();

    const mockServer = { registerTool: vi.fn() };
    registerListProjects(mockServer as never, mockContext(listProjects, getProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({});
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toEqual(all);
    expect(listProjects).toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });
});
