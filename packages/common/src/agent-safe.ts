/**
 * Irrecoverable MCP tool names that must never be registered (sans `lightdash_` prefix).
 */

export const IRRECOVERABLE_TOOL_DENYLIST = [
  'delete_member',
  'permanent_delete_content',
  'create_space',
  'update_space',
  'delete_space',
] as const;
