/**
 * Registers MCP capabilities for a profile.
 */

import { bindServerProfile } from '../audit/server-profile.js';
import { getDefaultProfile } from '../profiles/index.js';
import { registerTools } from '../tools/registry.js';

import type { McpContextProvider } from './request-context.js';
import type { ProfileDefinition } from '../profiles/types.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type RegisterCapabilitiesOptions = {
  /** Profile to register (defaults to {@link getDefaultProfile}). */
  profile?: ProfileDefinition;
};

/**
 * Registers MCP capabilities for the given profile.
 * Tools come from profile.tools (ToolModule imports).
 */
export function registerCapabilities(
  server: McpServer,
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): void {
  const profile = options?.profile ?? getDefaultProfile();
  bindServerProfile(server, profile.id);
  registerTools(server, contextProvider, profile.tools);
  profile.registerPrompts(server);
  profile.registerResources(server);
}
