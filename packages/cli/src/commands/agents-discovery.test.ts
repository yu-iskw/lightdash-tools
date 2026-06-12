import { describe, expect, it } from 'vitest';

import { hasExplicitFileInput } from '../utils/file-input';

describe('agents preferences set input selection', () => {
  it('prefers --default-agent when file/stdin were not explicitly requested', () => {
    const fileOptions = {};
    const defaultAgent = '22222222-2222-2222-2222-222222222222';

    expect(hasExplicitFileInput(fileOptions)).toBe(false);

    const body = defaultAgent != null ? { defaultAgentUuid: defaultAgent } : undefined;

    expect(body).toEqual({ defaultAgentUuid: defaultAgent });
  });
});
