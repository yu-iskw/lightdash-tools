import type { McpAuthMode } from './auth/auth-mode.js';
import type { LightdashClient } from '@lightdash-tools/client';

export interface LightdashMcpRequestContext {
  lightdashClient: LightdashClient;
  auth: {
    mode: McpAuthMode;
    subject?: string;
    tokenHash?: string;
    scopes?: string[];
  };
  governance: {
    /** Active project pin from HTTP `X-Lightdash-Project` (request-scoped). */
    pinnedProjectUuid?: string;
  };
}

export interface McpContextProvider<TExtra = unknown> {
  getContext(extra?: TExtra): Promise<LightdashMcpRequestContext>;
}
