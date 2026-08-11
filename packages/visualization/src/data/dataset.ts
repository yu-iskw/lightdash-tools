/**
 * Normalized dataset contract for renderers.
 */

export type VisualizationDataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'unknown';

export type VisualizationSemanticType = 'dimension' | 'metric' | 'unknown';

export interface FieldFormat {
  type?: 'number' | 'currency' | 'percent' | 'string';
  currency?: string;
  maximumFractionDigits?: number;
}

export interface VisualizationColumn {
  fieldId: string;
  label: string;
  semanticType: VisualizationSemanticType;
  dataType: VisualizationDataType;
  format?: FieldFormat;
}

export type VisualizationRow = Record<string, unknown>;

export interface DatasetProvenance {
  projectUuid?: string;
  explore?: string;
  queriedAt?: string;
  queryFingerprint?: string;
}

export interface VisualizationDataset {
  columns: VisualizationColumn[];
  rows: VisualizationRow[];
  provenance?: DatasetProvenance;
  truncated?: boolean;
  warnings?: string[];
}

export function createDataset(input: {
  columns: VisualizationColumn[];
  rows: VisualizationRow[];
  provenance?: DatasetProvenance;
  truncated?: boolean;
  warnings?: string[];
}): VisualizationDataset {
  return {
    columns: input.columns,
    rows: input.rows,
    provenance: input.provenance,
    truncated: input.truncated,
    warnings: input.warnings,
  };
}
