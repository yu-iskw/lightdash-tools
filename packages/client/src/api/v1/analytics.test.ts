/**
 * Analytics client unit tests.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalyticsClient } from './analytics';

import type { HttpClient } from '../../http/http-client';

describe('AnalyticsClient', () => {
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

  it('getUserActivity calls GET /analytics/user-activity/{projectUuid}', async () => {
    const client = new AnalyticsClient(mockHttp);
    const mockResponse = { numberUsers: 1, chartViews: [], dashboardViews: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getUserActivity('p1');
    expect(mockHttp.get).toHaveBeenCalledWith('/analytics/user-activity/p1');
    expect(result).toEqual(mockResponse);
  });
});
