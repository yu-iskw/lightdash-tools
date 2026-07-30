/**
 * Tool registration barrel.
 *
 * Tools are a fixed registration list (package-is-allowlist): only handlers
 * registered here appear in tools/list. There is no env/CLI tool filter.
 * Handlers arrive with the semantic-layer tools work; empty for now.
 */

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/server';

export function registerTools(_server: McpServer, _contextProvider: McpContextProvider): void {
  // Fixed tool handlers land here; no runtime allowlist.
}
