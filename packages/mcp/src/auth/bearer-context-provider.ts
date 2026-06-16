import { createBearerConfig, LightdashClient, SecretString } from '@lightdash-tools/client';

import { buildMcpGovernance } from '../governance.js';

import { hashToken } from './token-hash.js';

import type { McpHttpConfig } from '../config/load-mcp-config.js';
import type { LightdashMcpRequestContext, McpContextProvider } from '../request-context.js';

export interface BearerContextProviderOptions {
  baseUrl: string;
  accessToken: SecretString | string;
  proxyAuthorization?: SecretString;
  subject?: string;
  scopes?: string[];
}

/** Session- or request-scoped context using a Lightdash OAuth bearer token. */
export class BearerContextProvider implements McpContextProvider {
  private options: BearerContextProviderOptions;
  private tokenHash: string;

  constructor(options: BearerContextProviderOptions) {
    this.options = options;
    this.tokenHash = hashToken(this.readAccessToken());
  }

  getTokenHash(): string {
    return this.tokenHash;
  }

  updateAccessToken(accessToken: SecretString | string, scopes?: string[]): void {
    this.options = {
      ...this.options,
      accessToken,
      scopes: scopes ?? this.options.scopes,
    };
    this.tokenHash = hashToken(this.readAccessToken());
  }

  async getContext(): Promise<LightdashMcpRequestContext> {
    const client = new LightdashClient(
      createBearerConfig({
        baseUrl: this.options.baseUrl,
        accessToken: this.options.accessToken,
        proxyAuthorization: this.options.proxyAuthorization,
      }),
    );

    return {
      lightdashClient: client,
      auth: {
        mode: 'lightdash-oauth',
        tokenHash: this.tokenHash,
        subject: this.options.subject,
        scopes: this.options.scopes,
      },
      governance: buildMcpGovernance(),
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
  oauth: { accessToken: string; subject?: string; scopes?: string[] },
): BearerContextProvider {
  return new BearerContextProvider({
    baseUrl: config.lightdashUrl,
    accessToken: oauth.accessToken,
    proxyAuthorization: config.proxyAuthorization,
    subject: oauth.subject,
    scopes: oauth.scopes,
  });
}
