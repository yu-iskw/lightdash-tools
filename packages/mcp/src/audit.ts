/**
 * Re-exports the shared audit logger from @lightdash-tools/common.
 * The canonical implementation lives in common so the CLI can also use it.
 */
export { getSessionId, initAuditLog, logAuditEntry } from '@lightdash-tools/common';
export type { AuditLogEntry, AuditStatus } from '@lightdash-tools/common';
