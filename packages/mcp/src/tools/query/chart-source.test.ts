import { describe, expect, it, vi } from 'vitest';

import { classifyChartSource } from './chart-source.js';

import type { LightdashClient } from '@lightdash-tools/client';

describe('classifyChartSource', () => {
  it('returns sql when search match has source sql', async () => {
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [
              {
                contentType: 'chart',
                uuid: 'u1',
                slug: 'sql-chart',
                source: 'sql',
              },
            ],
          }),
        },
      },
    } as unknown as LightdashClient;

    await expect(classifyChartSource(client, 'p1', 'sql-chart')).resolves.toBe('sql');
    expect(client.v2.content.searchContent).toHaveBeenCalledWith({
      projectUuids: ['p1'],
      contentTypes: ['chart'],
      search: 'sql-chart',
      pageSize: 25,
    });
  });

  it('returns semantic for dbt_explore source', async () => {
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [
              {
                contentType: 'chart',
                uuid: 'u2',
                slug: 'metric-chart',
                source: 'dbt_explore',
              },
            ],
          }),
        },
      },
    } as unknown as LightdashClient;

    await expect(classifyChartSource(client, 'p1', 'u2')).resolves.toBe('semantic');
  });

  it('returns unknown when no exact match', async () => {
    const client = {
      v2: {
        content: {
          searchContent: vi.fn().mockResolvedValue({
            data: [{ contentType: 'chart', uuid: 'other', slug: 'other', source: 'sql' }],
          }),
        },
      },
    } as unknown as LightdashClient;

    await expect(classifyChartSource(client, 'p1', 'missing')).resolves.toBe('unknown');
  });
});
