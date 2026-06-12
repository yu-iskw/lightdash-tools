/**
 * RFC Phase 2 MCP capability registration (tools, resources, prompts, completion).
 */

import {
  getMcpProfiles,
  hasMcpProfile,
  MCP_PROFILE_CORE_LIFECYCLE,
  MCP_PROFILE_EVALUATIONS,
} from './config.js';
import { registerPrompts } from './prompts/index.js';
import { registerResources } from './resources/index.js';
import { registerTools } from './tools/index.js';

import type { McpProfile } from './config.js';
import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type RegisterCapabilitiesOptions = {
  /** Override active profiles (defaults to LIGHTDASH_TOOLS_MCP_PROFILES). */
  profiles?: Set<McpProfile>;
};

/**
 * Registers MCP capabilities based on active profiles.
 * Tools are always registered; resources, prompts, and completion are profile-gated.
 */
export function registerCapabilities(
  server: McpServer,
  client: LightdashClient,
  options?: RegisterCapabilitiesOptions,
): void {
  const profiles = options?.profiles ?? getMcpProfiles();

  registerTools(server, client);

  if (hasMcpProfile(MCP_PROFILE_EVALUATIONS, profiles)) {
    registerResources(server, client);
  }

  if (
    hasMcpProfile(MCP_PROFILE_CORE_LIFECYCLE, profiles) ||
    hasMcpProfile(MCP_PROFILE_EVALUATIONS, profiles)
  ) {
    registerPrompts(server, client, profiles);
  }
}
