/**
 * Profile packaging types (tools from the operation catalog, ADR-0006).
 */

import type { ProfileId } from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

export type { ProfileId };

export type ProfileDefinition = {
  id: ProfileId;
  /** Fixed Streamable HTTP MCP endpoint path for this profile. */
  path: `/${string}`;
  /**
   * MCP server display name. Defaults to `lightdash-mcp-${id}`.
   * Use a shorter name when combined with `lightdash_*` tools would exceed ~60 chars.
   */
  serverName?: string;
  /**
   * Exposed MCP tool names (sans `lightdash_` prefix) for this mount.
   * Bind a named export from packages/common/src/operations/profile-membership.ts
   * (membership SSOT). Do not hand-edit a parallel list in the MCP package.
   */
  mcpToolNames: readonly string[];
  registerPrompts: (server: McpServer) => void;
  registerResources: (server: McpServer) => void;
};
