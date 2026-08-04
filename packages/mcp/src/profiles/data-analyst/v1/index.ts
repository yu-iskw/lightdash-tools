/**
 * Data-analyst profile: explore discovery + ad-hoc metric-query execution (ADR-0020).
 */

import { DATA_ANALYST_MCP_TOOLS } from '@lightdash-tools/common';

import { registerDataAnalystPrompts } from './prompts.js';
import { registerDataAnalystPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const DATA_ANALYST_PROFILE_PATH = '/data-analyst/v1/mcp' as const;

export const dataAnalystProfile: ProfileDefinition = {
  id: 'data-analyst',
  path: DATA_ANALYST_PROFILE_PATH,
  serverName: 'lightdash-mcp-analyst',
  mcpToolNames: DATA_ANALYST_MCP_TOOLS,
  registerPrompts: (server) => {
    registerDataAnalystPrompts(server);
  },
  registerResources: (server) => {
    registerDataAnalystPlaybook(server);
  },
};
