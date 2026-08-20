/**
 * MCP serving profile ids (fixed HTTP mounts / stdio subcommands).
 */

export const PROFILE_IDS = [
  'ai-agent-chat',
  'ai-agent-ops',
  'content-developer',
  'content-governance',
  'content-reader',
  'data-analyst',
  'organization-audit',
  'semantic-layer',
] as const;

export type ProfileId = (typeof PROFILE_IDS)[number];
