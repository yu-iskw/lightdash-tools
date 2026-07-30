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
    allowedProjectUuids: string[];
    /** Active project pin from `X-Lightdash-Project` or `LIGHTDASH_TOOLS_PINNED_PROJECT`. */
    pinnedProjectUuid?: string;
  };
}

export interface McpContextProvider<TExtra = unknown> {
  getContext(extra?: TExtra): Promise<LightdashMcpRequestContext>;
}
