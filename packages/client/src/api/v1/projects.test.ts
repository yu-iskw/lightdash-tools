import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ProjectsClient } from './projects';

import type { HttpClient } from '../../http/http-client';

describe('ProjectsClient', () => {
  let mockHttp: HttpClient;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as HttpClient;
  });

  it('getProject should call GET /projects/{projectUuid}', async () => {
    const client = new ProjectsClient(mockHttp);
    const project = { projectUuid: 'p1', name: 'Test' };
    vi.mocked(mockHttp.get).mockResolvedValue(project);
    const result = await client.getProject('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1');
    expect(result).toEqual(project);
  });

  it('listProjects should call GET /org/projects', async () => {
    const client = new ProjectsClient(mockHttp);
    const list = [{ projectUuid: 'p1', name: 'P1' }];
    vi.mocked(mockHttp.get).mockResolvedValue(list);
    const result = await client.listProjects();
    expect(mockHttp.get).toHaveBeenCalledWith('/org/projects');
    expect(result).toEqual(list);
  });

  it('listChartsInProject should call GET /projects/{projectUuid}/charts', async () => {
    const client = new ProjectsClient(mockHttp);
    const charts: unknown[] = [];
    vi.mocked(mockHttp.get).mockResolvedValue(charts);
    const result = await client.listChartsInProject('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/charts');
    expect(result).toEqual(charts);
  });

  it('listVerifiedContent should call GET /projects/{projectUuid}/content-verification', async () => {
    const client = new ProjectsClient(mockHttp);
    const items = [
      {
        contentType: 'chart' as const,
        uuid: 'c1',
        contentUuid: 'c1',
        name: 'Verified chart',
        description: null,
        spaceUuid: 's1',
        spaceName: 'Space',
        views: 10,
        lastUpdatedAt: null,
        verifiedAt: '2026-01-01T00:00:00.000Z',
        verifiedBy: { userUuid: 'u1', firstName: 'Ada', lastName: 'Lovelace' },
        chartKind: 'vertical_bar' as const,
        exploreName: 'orders',
      },
    ];
    vi.mocked(mockHttp.get).mockResolvedValue(items);
    const result = await client.listVerifiedContent('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/content-verification');
    expect(result).toEqual(items);
  });
});
