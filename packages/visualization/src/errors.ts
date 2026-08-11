/**
 * Visualization error codes (machine-readable).
 */

export type VisualizationErrorCode =
  | 'INVALID_SPEC'
  | 'UNSUPPORTED_SPEC_VERSION'
  | 'UNKNOWN_TEMPLATE'
  | 'MISSING_REQUIRED_ROLE'
  | 'INCOMPATIBLE_FIELD_TYPE'
  | 'UNKNOWN_FIELD'
  | 'INVALID_INTERACTION'
  | 'UNSUPPORTED_TARGET'
  | 'UNSUPPORTED_REQUIRED_CAPABILITY'
  | 'TEMPLATE_TARGET_UNSUPPORTED'
  | 'DATASET_TOO_LARGE'
  | 'INVALID_VEGA_LITE'
  | 'EXTERNAL_RESOURCE_BLOCKED'
  | 'VEGA_LITE_ESCAPE_HATCH_BANNED';

export class VisualizationError extends Error {
  readonly code: VisualizationErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: VisualizationErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'VisualizationError';
    this.code = code;
    this.details = details;
  }
}

export type VisualizationWarningCode =
  | 'CAPABILITY_DEGRADED'
  | 'DATA_TRUNCATED'
  | 'HIGH_CARDINALITY'
  | 'LONG_LABELS'
  | 'NULL_VALUES'
  | 'TARGET_LAYOUT_APPROXIMATION'
  | 'UNSUPPORTED_OPTION_IGNORED';

export interface VisualizationWarning {
  code: VisualizationWarningCode;
  message: string;
  details?: Record<string, unknown>;
}
