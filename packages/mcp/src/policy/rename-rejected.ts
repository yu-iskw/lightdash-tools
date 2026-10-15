/**
 * Coded rejection for a rename instruction that must not be previewed or posted.
 * Lives next to the content-developer error mapper so policy does not import tools.
 */

export type RenameRejectCode =
  'RENAME_DRY_RUN' | 'RENAME_FIELD_UNLISTED' | 'RENAME_TARGET' | 'RENAME_UNCHANGED';

export class RenameRejectedError extends Error {
  readonly code: RenameRejectCode;

  constructor(code: RenameRejectCode, message: string) {
    super(message);
    this.name = 'RenameRejectedError';
    this.code = code;
  }
}
