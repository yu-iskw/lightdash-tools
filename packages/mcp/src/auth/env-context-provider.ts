import { type LightdashClient } from '@lightdash-tools/client';

import { getAllowedProjectUuids, getClient, getSafetyMode, isDryRunMode } from '../config.js';

import type { McpAuthMode } from './auth-mode.js';
import type { LightdashMcpRequestContext, McpContextProvider } from '../request-context.js';

function buildGovernance(): LightdashMcpRequestContext['governance'] {
  return {
    safetyMode: getSafetyMode(),
    dryRun: isDryRunMode(),
    allowedProjectUuids: getAllowedProjectUuids(),
  };
}

/** Process-scoped context using LIGHTDASH_URL + LIGHTDASH_API_KEY (STDIO, none, shared-key upstream). */
export class EnvContextProvider implements McpContextProvider {
  private readonly client: LightdashClient;
  private readonly mode: McpAuthMode;

  constructor(options?: { mode?: McpAuthMode; client?: LightdashClient }) {
    this.mode = options?.mode ?? 'env';
    this.client = options?.client ?? getClient();
  }

  async getContext(): Promise<LightdashMcpRequestContext> {
    return {
      lightdashClient: this.client,
      auth: { mode: this.mode },
      governance: buildGovernance(),
    };
  }
}
