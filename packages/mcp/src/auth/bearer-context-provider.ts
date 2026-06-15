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
  private readonly options: BearerContextProviderOptions;
  private readonly tokenHash: string;

  constructor(options: BearerContextProviderOptions) {
    this.options = options;
    const rawToken =
      options.accessToken instanceof SecretString
        ? options.accessToken.expose()
        : options.accessToken;
    this.tokenHash = hashToken(rawToken);
  }

  getTokenHash(): string {
    return this.tokenHash;
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
