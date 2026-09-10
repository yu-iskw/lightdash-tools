/**
 * Light profile catalog (no ToolModule imports).
 */

import { PROFILE_IDS } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PROFILE_ID,
  getDefaultProfilePath,
  getProfileIdByPath,
  getProfilePath,
  listCatalogProfilePaths,
  parseProfileId,
  PROFILE_PATHS,
  SEMANTIC_LAYER_PROFILE_PATH,
} from './catalog.js';

describe('profile catalog', () => {
  it('maps every PROFILE_IDS entry to a fixed path', () => {
    expect(Object.keys(PROFILE_PATHS).sort()).toEqual([...PROFILE_IDS].sort());
    expect(DEFAULT_PROFILE_ID).toBe('semantic-layer');
    expect(getDefaultProfilePath()).toBe(SEMANTIC_LAYER_PROFILE_PATH);
    expect(listCatalogProfilePaths()).toHaveLength(PROFILE_IDS.length);
  });

  it('parseProfileId validates known ids only', () => {
    expect(parseProfileId('content-reader')).toBe('content-reader');
    expect(parseProfileId('nope')).toBeUndefined();
  });

  it('resolves ids from paths with trailing-slash normalization', () => {
    expect(getProfileIdByPath(SEMANTIC_LAYER_PROFILE_PATH)).toBe('semantic-layer');
    expect(getProfileIdByPath(`${SEMANTIC_LAYER_PROFILE_PATH}/`)).toBe('semantic-layer');
    expect(getProfileIdByPath('/mcp')).toBeUndefined();
    expect(getProfilePath('data-analyst')).toBe('/data-analyst/v1/mcp');
  });
});
