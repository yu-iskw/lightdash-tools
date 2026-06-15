import type { McpAuthMode } from './auth/auth-mode.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { SafetyMode } from '@lightdash-tools/common';

export interface LightdashMcpRequestContext {
  lightdashClient: LightdashClient;
  auth: {
    mode: McpAuthMode;
    subject?: string;
    tokenHash?: string;
    scopes?: string[];
  };
  governance: {
    safetyMode: SafetyMode;
    dryRun: boolean;
    allowedProjectUuids: string[];
  };
}

export interface McpContextProvider<TExtra = unknown> {
  getContext(extra?: TExtra): Promise<LightdashMcpRequestContext>;
}
