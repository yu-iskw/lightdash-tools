/**
 * Shared Vitest beforeAll: load all profile ToolModules into the process cache.
 */

import { beforeAll } from 'vitest';

import { preloadAllProfiles } from '../index.js';

/** Call at the top of a describe block that uses getProfile after process boot (preload required). */
export function usePreloadedProfiles(): void {
  beforeAll(async () => {
    await preloadAllProfiles();
  });
}
