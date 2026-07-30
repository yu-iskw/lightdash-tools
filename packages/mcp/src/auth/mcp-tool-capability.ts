import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from '@lightdash-tools/common';

import type { ToolAnnotations } from '@lightdash-tools/common';

/** Internal read/write classification for OAuth scope checks — not derived from MCP presentation hints. */
export enum RequiredMcpScope {
  READ = 'read',
  WRITE = 'write',
}

export type McpToolCapability = {
  annotations: ToolAnnotations;
  requiredMcpScope: RequiredMcpScope;
};

export const READ_ONLY_CAPABILITY: McpToolCapability = {
  annotations: READ_ONLY_DEFAULT,
  requiredMcpScope: RequiredMcpScope.READ,
};

export const WRITE_IDEMPOTENT_CAPABILITY: McpToolCapability = {
  annotations: WRITE_IDEMPOTENT,
  requiredMcpScope: RequiredMcpScope.WRITE,
};

export function isReadOnlyMcpScope(scope: RequiredMcpScope): boolean {
  return scope === RequiredMcpScope.READ;
}
