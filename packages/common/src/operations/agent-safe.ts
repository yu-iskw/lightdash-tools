/**
 * Agent-safe surface policy helpers (ADR-0004 / ADR-0013).
 */

import { listBannedMcpToolNames } from './registry';

export { listBannedMcpToolNames } from './registry';

/** Banned MCP tool names (without `lightdash_` prefix) for regression tests. */
export const IRRECOVERABLE_TOOL_DENYLIST = listBannedMcpToolNames();
