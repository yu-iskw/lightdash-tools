/**
 * Re-exports the shared audit logger from @lightdash-tools/common.
 * The canonical implementation lives in common so the CLI can also use it.
 */
export { getSessionId, initAuditLog } from '@lightdash-tools/common';
