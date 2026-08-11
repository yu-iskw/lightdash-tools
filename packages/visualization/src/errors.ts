/**
 * Visualization error codes (machine-readable).
 */

export type VisualizationErrorCode =
  | 'DATASET_TOO_LARGE'
  | 'EXTERNAL_RESOURCE_BLOCKED'
  | 'INCOMPATIBLE_FIELD_TYPE'
  | 'INVALID_SPEC'
  | 'MISSING_REQUIRED_ROLE'
  | 'TEMPLATE_TARGET_UNSUPPORTED'
  | 'UNKNOWN_FIELD'
  | 'UNKNOWN_TEMPLATE'
  | 'UNSUPPORTED_REQUIRED_CAPABILITY'
  | 'UNSUPPORTED_SPEC_VERSION'
  | 'UNSUPPORTED_TARGET'
  | 'VEGA_LITE_ESCAPE_HATCH_BANNED';

export class VisualizationError extends Error {
  readonly code: VisualizationErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: VisualizationErrorCode, message: string, details?: Record<string, unknown>) {
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
