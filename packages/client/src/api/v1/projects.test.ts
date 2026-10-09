import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ProjectsClient, type VerifiedContentListItem } from './projects';

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
    const verifiedBy = { userUuid: 'u1', firstName: 'Ada', lastName: 'Lovelace' };
    const shared = {
      description: null,
      spaceUuid: 's1',
      spaceName: 'Space',
      views: 10,
      lastUpdatedAt: null,
      verifiedAt: '2026-01-01T00:00:00.000Z',
      verifiedBy,
    };
    const items: VerifiedContentListItem[] = [
      {
        ...shared,
        contentType: 'chart',
        uuid: 'c1',
        contentUuid: 'c1',
        name: 'Verified chart',
        slug: 'verified-chart',
        chartKind: 'vertical_bar',
        exploreName: 'orders',
      },
      {
        ...shared,
        contentType: 'dashboard',
        uuid: 'd1',
        contentUuid: 'd1',
        name: 'Verified dashboard',
        slug: 'verified-dashboard',
      },
      {
        ...shared,
        contentType: 'data_app',
        uuid: 'a1',
        contentUuid: 'a1',
        name: 'Verified data app',
        slug: 'verified-data-app',
      },
      {
        ...shared,
        contentType: 'document',
        uuid: 'doc1',
        contentUuid: 'doc1',
        name: 'Verified document',
        slug: 'verified-document',
      },
    ];
    vi.mocked(mockHttp.get).mockResolvedValue(items);
    const result = await client.listVerifiedContent('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/content-verification');
    expect(result).toEqual(items);
  });
});
