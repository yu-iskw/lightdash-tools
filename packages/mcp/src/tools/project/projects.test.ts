import { afterEach, describe, expect, it, vi } from 'vitest';

import { runWithProjectPinAsync } from '../../governance/project-pin.js';
import { CREDENTIALS_OMITTED_WARNING } from '../lib/redaction.js';

import { registerGetProject, registerListProjects } from './projects.js';

import type { McpContextProvider } from '../../server/request-context.js';

const PINNED = '550e8400-e29b-41d4-a716-446655440000';
const OTHER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function mockContext(
  listProjects: ReturnType<typeof vi.fn>,
  getProject: ReturnType<typeof vi.fn>,
): McpContextProvider {
  return {
    getContext: async () => ({
      lightdashClient: {
        v1: { projects: { listProjects, getProject } },
      },
      auth: { mode: 'none' as const },
    }),
  } as unknown as McpContextProvider;
}

describe('registerListProjects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns only the pinned project summary when X-Lightdash-Project ALS is set', async () => {
    const pinnedProject = {
      projectUuid: PINNED,
      name: 'Pinned',
      type: 'DEFAULT',
      warehouseConnection: { type: 'bigquery', password: 'secret' },
      dbtConnection: { type: 'github', personal_access_token: 'ghp_x' },
      schedulerFailureContactOverride: 'ops@example.com',
    };
    const listProjects = vi.fn();
    const getProject = vi.fn().mockResolvedValue(pinnedProject);

    const mockServer = { registerTool: vi.fn() };
    registerListProjects(mockServer as never, mockContext(listProjects, getProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    await runWithProjectPinAsync(PINNED, async () => {
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      const body = JSON.parse(result.content[0].text) as {
        data: Array<Record<string, unknown>>;
        warnings: unknown[];
      };
      expect(body.data).toEqual([
        {
          projectUuid: PINNED,
          name: 'Pinned',
          type: 'DEFAULT',
          warehouseType: 'bigquery',
        },
      ]);
      expect(body.warnings).toEqual([CREDENTIALS_OMITTED_WARNING]);
      expect(JSON.stringify(body)).not.toContain('secret');
      expect(JSON.stringify(body)).not.toContain('ghp_x');
      expect(getProject).toHaveBeenCalledWith(PINNED);
      expect(listProjects).not.toHaveBeenCalled();
    });
  });

  it('lists project summaries when no pin is set', async () => {
    const all = [
      { projectUuid: PINNED, name: 'A', type: 'DEFAULT', warehouseType: 'snowflake' },
      { projectUuid: OTHER, name: 'B', type: 'DEFAULT', warehouseType: 'bigquery' },
    ];
    const listProjects = vi.fn().mockResolvedValue(all);
    const getProject = vi.fn();

    const mockServer = { registerTool: vi.fn() };
    registerListProjects(mockServer as never, mockContext(listProjects, getProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({});
    expect(result.isError).toBeUndefined();
    const body = JSON.parse(result.content[0].text) as {
      data: Array<Record<string, unknown>>;
      warnings: unknown[];
    };
    expect(body.data).toEqual([
      {
        projectUuid: PINNED,
        name: 'A',
        type: 'DEFAULT',
        warehouseType: 'snowflake',
      },
      {
        projectUuid: OTHER,
        name: 'B',
        type: 'DEFAULT',
        warehouseType: 'bigquery',
      },
    ]);
    expect(body.warnings).toEqual([CREDENTIALS_OMITTED_WARNING]);
    expect(listProjects).toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });
});

describe('registerGetProject', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LIGHTDASH_TOOLS_PROJECT_UUID;
  });

  it('returns metadata summary without connection secrets (pin-aware / semantic-layer)', async () => {
    const getProject = vi.fn().mockResolvedValue({
      projectUuid: PINNED,
      name: 'Pinned',
      type: 'DEFAULT',
      organizationUuid: 'org-1',
      warehouseConnection: { type: 'postgres', password: 'db-pass' },
      dbtConnection: { type: 'github', personal_access_token: 'token' },
      schedulerFailureContactOverride: 'alert@example.com',
    });
    const listProjects = vi.fn();

    const mockServer = { registerTool: vi.fn() };
    registerGetProject(mockServer as never, mockContext(listProjects, getProject));
    const [, , handler] = mockServer.registerTool.mock.calls[0];

    const result = await handler({ projectUuid: PINNED });
    const body = JSON.parse(result.content[0].text) as {
      data: Record<string, unknown>;
      warnings: unknown[];
    };
    expect(body.data.projectUuid).toBe(PINNED);
    expect(body.data.name).toBe('Pinned');
    expect(body.data.warehouseType).toBe('postgres');
    expect(body.data).not.toHaveProperty('readerCapabilities');
    expect(body.warnings).toEqual([CREDENTIALS_OMITTED_WARNING]);
    expect(body.data).not.toHaveProperty('warehouseConnection');
    expect(body.data).not.toHaveProperty('dbtConnection');
    expect(JSON.stringify(body)).not.toContain('db-pass');
    expect(JSON.stringify(body)).not.toContain('token');
  });

  it('does not use LIGHTDASH_TOOLS_PROJECT_UUID on the non-reader path', async () => {
    process.env.LIGHTDASH_TOOLS_PROJECT_UUID = PINNED;
    const getProject = vi.fn();
    const mockServer = { registerTool: vi.fn() };
    registerGetProject(mockServer as never, mockContext(vi.fn(), getProject));
    const [, options, handler] = mockServer.registerTool.mock.calls[0];
    expect(options.description).not.toContain('LIGHTDASH_TOOLS_PROJECT_UUID');

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(getProject).not.toHaveBeenCalled();
  });

  it('includes readerCapabilities for content-reader persona', async () => {
    process.env.LIGHTDASH_TOOLS_PROJECT_UUID = PINNED;
    const getProject = vi.fn().mockResolvedValue({
      projectUuid: PINNED,
      name: 'Reader',
      type: 'DEFAULT',
    });
    const mockServer = { registerTool: vi.fn() };
    registerGetProject(mockServer as never, mockContext(vi.fn(), getProject), {
      personaId: 'content-reader',
    });
    const [, options, handler] = mockServer.registerTool.mock.calls[0];
    expect(options.description).toContain('LIGHTDASH_TOOLS_PROJECT_UUID');

    const result = await handler({});
    const body = JSON.parse(result.content[0].text) as {
      data: Record<string, unknown>;
      context: Record<string, unknown>;
    };
    expect(body.data.readerCapabilities).toEqual({
      canDiscoverContent: true,
      canExecuteSavedCharts: true,
      canExecuteSqlCharts: false,
      canExecuteDashboardTiles: true,
    });
    expect(body.context.projectUuid).toBe(PINNED);
    expect(getProject).toHaveBeenCalledWith(PINNED);
  });
});
