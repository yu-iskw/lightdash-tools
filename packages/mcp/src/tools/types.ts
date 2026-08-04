/**
 * Minimal self-describing MCP tool module (profile mounts import these).
 */

import type { McpContextProvider } from '../server/request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type ToolModule = {
  /** Short id (sans `lightdash_` prefix); wire name = `lightdash_` + id */
  id: string;
  register: (server: McpServer, contextProvider: McpContextProvider) => void;
};

const registeredIds = new Set<string>();
const variantIds = new Set<string>();

/** Build a ToolModule; throws if the same id is defined twice in this process. */
export function defineTool(id: string, register: ToolModule['register']): ToolModule {
  if (registeredIds.has(id) || variantIds.has(id)) {
    throw new Error(`Duplicate MCP tool id '${id}'`);
  }
  registeredIds.add(id);
  return { id, register };
}

/**
 * Same wire id, different register implementations for different profile mounts.
 * Use when profiles need distinct registration (e.g. capability envelopes) but one tools/list name.
 * Do not mix with {@link defineTool} for the same id.
 */
export function defineToolVariant(id: string, register: ToolModule['register']): ToolModule {
  if (registeredIds.has(id)) {
    throw new Error(`Cannot variant MCP tool id '${id}' after defineTool`);
  }
  variantIds.add(id);
  return { id, register };
}
