/**
 * Content-governance profile: elicitation-gated soft-delete and dashboard promote
 * (ADR-0015 / ADR-0017). Permanent purge and chart/SQL promote stay off MCP.
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';

import { registerContentGovernancePrompts } from './prompts.js';
import { registerContentGovernancePlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const CONTENT_GOVERNANCE_PROFILE_PATH = '/content-governance/v1/mcp' as const;

export const contentGovernanceProfile: ProfileDefinition = {
  id: 'content-governance',
  path: CONTENT_GOVERNANCE_PROFILE_PATH,
  serverName: 'lightdash-mcp-gov',
  mcpToolNames: listMcpToolNamesByProfile('content-governance'),
  registerPrompts: (server) => {
    registerContentGovernancePrompts(server);
  },
  registerResources: (server) => {
    registerContentGovernancePlaybook(server);
  },
};
