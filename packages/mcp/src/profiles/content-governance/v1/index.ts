/**
 * Content-governance profile: elicitation-gated soft-delete and dashboard promote
 * (ADR-0015 / ADR-0017). Permanent purge and chart/SQL promote stay off MCP.
 */

import { deleteChartTool } from '../../../tools/project/delete-chart.js';
import { deleteDashboardTool } from '../../../tools/project/delete-dashboard.js';
import { getDashboardPromoteDiffTool } from '../../../tools/project/get-dashboard-promote-diff.js';
import { promoteDashboardTool } from '../../../tools/project/promote-dashboard.js';

import { registerContentGovernancePrompts } from './prompts.js';
import { registerContentGovernancePlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const CONTENT_GOVERNANCE_PROFILE_PATH = '/content-governance/v1/mcp' as const;

export const contentGovernanceProfile: ProfileDefinition = {
  id: 'content-governance',
  path: CONTENT_GOVERNANCE_PROFILE_PATH,
  serverName: 'lightdash-mcp-gov',
  tools: [deleteChartTool, deleteDashboardTool, getDashboardPromoteDiffTool, promoteDashboardTool],
  registerPrompts: registerContentGovernancePrompts,
  registerResources: registerContentGovernancePlaybook,
};
