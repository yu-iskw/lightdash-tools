/**
 * Persona type definitions (tools selected from shared registry).
 */

import type { ToolId } from '../tools/registry.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type PersonaId = 'semantic-layer';

export type PersonaDefinition = {
  id: PersonaId;
  /** Fixed Streamable HTTP MCP endpoint path for this persona. */
  path: `/${string}`;
  toolIds: readonly ToolId[];
  registerPrompts: (server: McpServer) => void;
  registerResources: (server: McpServer) => void;
};
