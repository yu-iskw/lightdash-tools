/**
 * Profile packaging types — tools are ToolModules imported by each profile.
 */

import type { ToolModule } from '../tools/types.js';
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
   * Mounted tools for this profile (import ToolModules; array order is tools/list order).
   */
  tools: readonly ToolModule[];
  registerPrompts: (server: McpServer) => void;
  registerResources: (server: McpServer) => void;
};
