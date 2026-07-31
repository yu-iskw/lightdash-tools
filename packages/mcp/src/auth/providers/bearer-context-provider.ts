import { createBearerConfig, LightdashClient, SecretString } from '@lightdash-tools/client';

import { hashToken } from '../token-hash.js';

import type { McpHttpConfig } from '../../config/load-mcp-config.js';
import type {
  LightdashMcpRequestContext,
  McpContextProvider,
} from '../../server/request-context.js';

export interface BearerContextProviderOptions {
  baseUrl: string;
  accessToken: SecretString | string;
  proxyAuthorization?: SecretString;
  subject?: string;
}

/** Session- or request-scoped context using a Lightdash OAuth bearer token. */
export class BearerContextProvider implements McpContextProvider {
  private options: BearerContextProviderOptions;
  private tokenHash: string;
  private cachedClient?: LightdashClient;

  constructor(options: BearerContextProviderOptions) {
    this.options = options;
    this.tokenHash = hashToken(this.readAccessToken());
  }

  getTokenHash(): string {
    return this.tokenHash;
  }

  updateAccessToken(accessToken: SecretString | string): void {
    this.options = {
      ...this.options,
      accessToken,
    };
    this.tokenHash = hashToken(this.readAccessToken());
    this.cachedClient = undefined;
  }

  async getContext(): Promise<LightdashMcpRequestContext> {
    if (!this.cachedClient) {
      this.cachedClient = new LightdashClient(
        createBearerConfig({
          baseUrl: this.options.baseUrl,
          accessToken: this.options.accessToken,
          proxyAuthorization: this.options.proxyAuthorization,
        }),
      );
    }

    return {
      lightdashClient: this.cachedClient,
      auth: {
        mode: 'lightdash-oauth',
        tokenHash: this.tokenHash,
        subject: this.options.subject,
      },
    };
  }

  private readAccessToken(): string {
    return this.options.accessToken instanceof SecretString
      ? this.options.accessToken.expose()
      : this.options.accessToken;
  }
}

export function createOAuthBearerProvider(
  config: Pick<McpHttpConfig, 'lightdashUrl' | 'proxyAuthorization'>,
  oauth: { accessToken: string; subject?: string },
): BearerContextProvider {
  return new BearerContextProvider({
    baseUrl: config.lightdashUrl,
    accessToken: oauth.accessToken,
    proxyAuthorization: config.proxyAuthorization,
    subject: oauth.subject,
  });
}
