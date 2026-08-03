/**
 * Persona type definitions (tools selected from shared registry).
 */

import type { ToolId } from '../tools/registry.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type PersonaId =
  | 'ai-agent-ops'
  | 'content-developer'
  | 'content-governance'
  | 'content-reader'
  | 'data-analyst'
  | 'organization-audit'
  | 'semantic-layer';

export type PersonaDefinition = {
  id: PersonaId;
  /** Fixed Streamable HTTP MCP endpoint path for this persona. */
  path: `/${string}`;
  /**
   * MCP server display name. Defaults to `lightdash-mcp-${id}`.
   * Use a shorter name when combined with `lightdash_*` tools would exceed ~60 chars.
   */
  serverName?: string;
  toolIds: readonly ToolId[];
  registerPrompts: (server: McpServer) => void;
  registerResources: (server: McpServer) => void;
};
