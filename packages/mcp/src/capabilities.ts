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
import type { McpContextProvider } from './request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

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
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): void {
  const profiles = options?.profiles ?? getMcpProfiles();

  registerTools(server, contextProvider);

  if (hasMcpProfile(MCP_PROFILE_EVALUATIONS, profiles)) {
    registerResources(server, contextProvider);
  }

  if (
    hasMcpProfile(MCP_PROFILE_CORE_LIFECYCLE, profiles) ||
    hasMcpProfile(MCP_PROFILE_EVALUATIONS, profiles)
  ) {
    registerPrompts(server, contextProvider, profiles);
  }
}
