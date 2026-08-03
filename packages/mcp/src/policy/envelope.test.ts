import { describe, expect, it } from 'vitest';

import { contentReaderEnvelope } from './envelope.js';

describe('contentReaderEnvelope', () => {
  const baseOpts = {
    projectUuid: '3dda11cb-aac8-42f7-82f1-26fa6b1afa80',
    projectPinned: false,
  };

  it('stamps the required profile onto context', () => {
    const reader = contentReaderEnvelope({ ok: true }, { ...baseOpts, profile: 'content-reader' });
    expect(reader.context.profile).toBe('content-reader');
    expect(reader.context.projectUuid).toBe(baseOpts.projectUuid);
    expect(reader.context.projectPinned).toBe(false);
    expect(reader.data).toEqual({ ok: true });

    const developer = contentReaderEnvelope(
      { ok: true },
      { ...baseOpts, profile: 'content-developer' },
    );
    expect(developer.context.profile).toBe('content-developer');
  });

  it('preserves coverage and warnings options', () => {
    const result = contentReaderEnvelope(
      { items: [] },
      {
        ...baseOpts,
        profile: 'content-reader',
        complete: false,
        truncated: true,
        inaccessibleResources: ['x'],
        warnings: [{ code: 'TRUNCATED', message: 'cut' }],
      },
    );
    expect(result.coverage).toEqual({
      complete: false,
      truncated: true,
      inaccessibleResources: ['x'],
    });
    expect(result.warnings).toEqual([{ code: 'TRUNCATED', message: 'cut' }]);
  });
});
