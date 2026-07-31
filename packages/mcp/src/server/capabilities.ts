/**
 * Register tools / prompts / resources for a persona.
 */

import { getDefaultPersona } from '../personas/index.js';
import { registerToolsByIds } from '../tools/registry.js';

import type { McpContextProvider } from './request-context.js';
import type { PersonaDefinition } from '../personas/types.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type RegisterCapabilitiesOptions = {
  /** Persona to register (defaults to the sole shipped persona). */
  persona?: PersonaDefinition;
};

/**
 * Registers MCP capabilities for the given persona.
 * Tools come from the shared registry via persona.toolIds.
 */
export function registerCapabilities(
  server: McpServer,
  contextProvider: McpContextProvider,
  options?: RegisterCapabilitiesOptions,
): void {
  const persona = options?.persona ?? getDefaultPersona();
  registerToolsByIds(server, contextProvider, persona.toolIds);
  persona.registerPrompts(server);
  persona.registerResources(server);
}
