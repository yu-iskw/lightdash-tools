import { type LightdashClient } from '@lightdash-tools/client';

import { getClient } from '../../config/runtime.js';

import type {
  LightdashMcpRequestContext,
  McpContextProvider,
} from '../../server/request-context.js';
import type { McpAuthMode } from '../auth-mode.js';

/** Process-scoped context using LIGHTDASH_URL + LIGHTDASH_API_KEY (STDIO, none, shared-key upstream). */
export class EnvContextProvider implements McpContextProvider {
  private cachedClient: LightdashClient | undefined;
  private readonly injectedClient: LightdashClient | undefined;
  private readonly mode: McpAuthMode;

  constructor(options?: { mode?: McpAuthMode; client?: LightdashClient }) {
    this.mode = options?.mode ?? 'env';
    this.injectedClient = options?.client;
  }

  async getContext(): Promise<LightdashMcpRequestContext> {
    return {
      lightdashClient: this.resolveClient(),
      auth: { mode: this.mode },
    };
  }

  private resolveClient(): LightdashClient {
    if (this.injectedClient) {
      return this.injectedClient;
    }
    this.cachedClient ??= getClient();
    return this.cachedClient;
  }
}
