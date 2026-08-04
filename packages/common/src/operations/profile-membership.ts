/**
 * MCP mount membership SSOT: literal tool-name arrays per serving profile.
 * Edit these lists to add/remove tools on a mount; catalog ops define tool metadata.
 */

import { PROFILE_IDS, type ProfileId } from './types';

export const AI_AGENT_OPS_MCP_TOOLS = [
  'list_project_agents',
  'get_project_agent',
  'evaluate_agent_readiness',
  'get_agent_suggestions',
  'get_agent_models',
  'get_explore_access_summary',
  'list_agent_threads',
  'get_agent_thread',
  'list_agent_evaluations',
  'get_agent_evaluation',
  'create_agent_evaluation',
  'update_agent_evaluation',
  'append_agent_evaluation_prompts',
  'delete_agent_evaluation',
  'run_agent_evaluation',
  'list_agent_evaluation_runs',
  'get_agent_eval_run_results',
] as const;

export const CONTENT_DEVELOPER_MCP_TOOLS = [
  'get_project',
  'search_content',
  'list_spaces',
  'get_space',
  'get_dashboard',
  'get_chart',
  'preview_chart_changes',
  'preview_dashboard_changes',
  'preview_content_move',
  'get_chart_as_code',
  'validate_chart',
  'validate_dashboard',
  'confirm_preview',
  'compare_chart_versions',
  'compare_dashboard_versions',
  'create_chart',
  'update_chart',
  'duplicate_chart',
  'create_dashboard',
  'update_dashboard',
  'duplicate_dashboard',
  'add_dashboard_tile',
  'move_dashboard_tile',
  'remove_dashboard_tile',
  'resize_dashboard_tile',
  'move_content',
] as const;

export const CONTENT_GOVERNANCE_MCP_TOOLS = [
  'delete_chart',
  'delete_dashboard',
  'get_dashboard_promote_diff',
  'promote_dashboard',
] as const;

export const CONTENT_READER_MCP_TOOLS = [
  'get_project',
  'search_content',
  'list_spaces',
  'get_space',
  'get_dashboard',
  'get_chart',
  'list_project_parameters',
  'get_project_parameters',
  'explain_content',
  'run_chart',
  'export_chart_image',
  'run_dashboard_tile',
  'get_query_result',
  'cancel_query',
] as const;

export const DATA_ANALYST_MCP_TOOLS = [
  'get_project',
  'list_explores',
  'get_explore',
  'list_dimensions',
  'list_metrics',
  'compile_query',
  'get_query_result',
  'cancel_query',
  'run_metric_query',
] as const;

export const ORGANIZATION_AUDIT_MCP_TOOLS = [
  'get_org_profile',
  'list_org_members',
  'get_org_member',
  'list_org_groups',
  'list_org_projects',
  'list_org_role_assignments',
  'list_custom_roles',
  'get_custom_role',
  'list_project_roles',
  'list_project_direct_access',
  'list_space_access',
  'resolve_effective_access',
  'list_content',
  'get_dashboard_meta',
  'list_validation_results',
  'get_project_user_activity',
  'list_project_schedulers',
  'get_scheduler',
] as const;

export const SEMANTIC_LAYER_MCP_TOOLS = [
  'list_projects',
  'get_project',
  'list_explores',
  'get_explore',
  'list_dimensions',
  'get_field_lineage',
  'list_metrics',
  'get_metric',
  'compile_query',
] as const;

export const MCP_TOOLS_BY_PROFILE = {
  'ai-agent-ops': AI_AGENT_OPS_MCP_TOOLS,
  'content-developer': CONTENT_DEVELOPER_MCP_TOOLS,
  'content-governance': CONTENT_GOVERNANCE_MCP_TOOLS,
  'content-reader': CONTENT_READER_MCP_TOOLS,
  'data-analyst': DATA_ANALYST_MCP_TOOLS,
  'organization-audit': ORGANIZATION_AUDIT_MCP_TOOLS,
  'semantic-layer': SEMANTIC_LAYER_MCP_TOOLS,
} as const satisfies Record<ProfileId, readonly string[]>;

/** MCP serving profiles that mount the given tool name (sans `lightdash_` prefix). */
export function listProfilesForMcpToolName(toolName: string): readonly ProfileId[] {
  const profiles: ProfileId[] = [];
  for (const profileId of PROFILE_IDS) {
    // eslint-disable-next-line security/detect-object-injection -- ProfileId from PROFILE_IDS
    const tools: readonly string[] = MCP_TOOLS_BY_PROFILE[profileId];
    if (tools.includes(toolName)) {
      profiles.push(profileId);
    }
  }
  return profiles;
}

for (const profileId of PROFILE_IDS) {
  // eslint-disable-next-line security/detect-object-injection -- ProfileId from PROFILE_IDS
  Object.freeze(MCP_TOOLS_BY_PROFILE[profileId]);
}
Object.freeze(MCP_TOOLS_BY_PROFILE);
