import { createHash } from 'node:crypto';

import { LightdashClient, SecretString } from '@lightdash-tools/client';

import { getAllowedProjectUuids, getSafetyMode, isDryRunMode } from '../config.js';

import type { LightdashMcpRequestContext, McpContextProvider } from '../request-context.js';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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
    const client = new LightdashClient({
      baseUrl: this.options.baseUrl,
      auth: {
        type: 'bearer',
        token: this.options.accessToken,
      },
      proxyAuthorization: this.options.proxyAuthorization,
    });

    return {
      lightdashClient: client,
      auth: {
        mode: 'lightdash-oauth',
        tokenHash: this.tokenHash,
        subject: this.options.subject,
        scopes: this.options.scopes,
      },
      governance: {
        safetyMode: getSafetyMode(),
        dryRun: isDryRunMode(),
        allowedProjectUuids: getAllowedProjectUuids(),
      },
    };
  }
}
