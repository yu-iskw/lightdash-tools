import { describe, expect, it, vi } from 'vitest';

import { findContentByUuid } from './developer-content-shared.js';

import type { LightdashClient } from '@lightdash-tools/client';

describe('findContentByUuid', () => {
  it('queries the exact uuids filter rather than text search', async () => {
    const searchContent = vi.fn().mockResolvedValue({
      status: 'ok',
      results: {
        data: [{ uuid: 'c1', name: 'Chart' }],
        pagination: undefined,
      },
    });
    const client = {
      v2: { content: { searchContent } },
    } as unknown as LightdashClient;

    const found = await findContentByUuid(client, 'p1', 'c1');
    expect(found).toEqual({ uuid: 'c1', name: 'Chart' });
    expect(searchContent).toHaveBeenCalledWith({
      projectUuids: ['p1'],
      uuids: ['c1'],
      pageSize: 50,
    });
  });
});
