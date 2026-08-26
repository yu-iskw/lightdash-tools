import { describe, expect, it } from 'vitest';

import { artifactToolResult } from './shared.js';

describe('artifactToolResult', () => {
  it('returns summary text plus embedded resource parts', () => {
    const result = artifactToolResult({
      summary: { data: { queryUuid: 'q1' }, context: { profile: 'content-reader' } },
      artifacts: [
        {
          kind: 'data',
          uri: 'lightdash://artifacts/content-reader/data/q1',
          mimeType: 'application/json',
          text: '[{"a":1}]',
          audience: ['assistant', 'user'],
          priority: 0.8,
        },
        {
          kind: 'sql',
          uri: 'lightdash://artifacts/content-reader/sql/s1',
          mimeType: 'text/sql',
          text: 'SELECT 1',
          audience: ['assistant', 'user'],
          priority: 0.6,
        },
      ],
      catalog: [
        {
          kind: 'data',
          uri: 'lightdash://artifacts/content-reader/data/q1',
          mimeType: 'application/json',
          included: true,
        },
        {
          kind: 'sql',
          uri: 'lightdash://artifacts/content-reader/sql/s1',
          mimeType: 'text/sql',
          included: true,
        },
      ],
    });

    expect(result.content).toHaveLength(3);
    expect(result.content[0]).toMatchObject({ type: 'text' });
    expect(result.content[1]).toMatchObject({
      type: 'resource',
      resource: {
        uri: 'lightdash://artifacts/content-reader/data/q1',
        mimeType: 'application/json',
        text: '[{"a":1}]',
      },
      annotations: { audience: ['assistant', 'user'], priority: 0.8 },
    });
    expect(result.content[2]).toMatchObject({
      type: 'resource',
      resource: { mimeType: 'text/sql', text: 'SELECT 1' },
      annotations: { audience: ['assistant', 'user'], priority: 0.6 },
    });
    expect(result.structuredContent).toMatchObject({
      data: { queryUuid: 'q1' },
      artifacts: [
        { kind: 'data', included: true },
        { kind: 'sql', included: true },
      ],
    });
    const summaryText = (result.content[0] as { text: string }).text;
    expect(summaryText).not.toContain('SELECT 1');
    expect(summaryText).not.toContain('[{"a":1}]');
  });

  it('omits resource parts when catalog marks artifacts not included', () => {
    const result = artifactToolResult({
      summary: { ok: true },
      artifacts: [],
      catalog: [
        {
          kind: 'sql',
          uri: 'lightdash://artifacts/content-reader/sql/s1',
          mimeType: 'text/sql',
          included: false,
        },
      ],
    });
    expect(result.content).toHaveLength(1);
    expect(result.structuredContent?.artifacts).toEqual([
      {
        kind: 'sql',
        uri: 'lightdash://artifacts/content-reader/sql/s1',
        mimeType: 'text/sql',
        included: false,
      },
    ]);
  });
});
