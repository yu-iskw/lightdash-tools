/**
 * Server config: Lightdash client.
 */

import { LightdashClient, mergeConfig } from '@lightdash-tools/client';

export function getClient(): LightdashClient {
  return new LightdashClient(mergeConfig(undefined));
}
