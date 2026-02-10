/**
 * Client utility for initializing LightdashClient from environment variables.
 */

import { LightdashClient } from '@lightdash-tools/client';

/**
 * Gets a LightdashClient instance initialized from environment variables.
 * Uses LIGHTDASH_URL and LIGHTDASH_API_KEY environment variables.
 *
 * @throws Error if required environment variables are missing
 */
export function getClient(): LightdashClient {
  return new LightdashClient(); // Uses env vars automatically
}
