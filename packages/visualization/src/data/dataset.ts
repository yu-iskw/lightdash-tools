/**
 * Normalized dataset contract and Zod parser.
 */

import { z } from 'zod';

import { VisualizationError } from '../errors';

export type VisualizationDataType =
  'boolean' | 'date' | 'number' | 'string' | 'timestamp' | 'unknown';

export type VisualizationSemanticType = 'dimension' | 'metric' | 'unknown';

export interface FieldFormat {
  type?: 'currency' | 'number' | 'percent' | 'string';
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

const fieldFormatSchema = z
  .object({
    type: z.enum(['currency', 'number', 'percent', 'string']).optional(),
    currency: z.string().optional(),
    maximumFractionDigits: z.number().int().nonnegative().optional(),
  })
  .strict();

const columnSchema = z
  .object({
    fieldId: z.string().min(1),
    label: z.string(),
    semanticType: z.enum(['dimension', 'metric', 'unknown']),
    dataType: z.enum(['boolean', 'date', 'number', 'string', 'timestamp', 'unknown']),
    format: fieldFormatSchema.optional(),
  })
  .strict();

const provenanceSchema = z
  .object({
    projectUuid: z.string().optional(),
    explore: z.string().optional(),
    queriedAt: z.string().optional(),
    queryFingerprint: z.string().optional(),
  })
  .strict();

export const visualizationDatasetSchema = z
  .object({
    columns: z.array(columnSchema),
    rows: z.array(z.record(z.string(), z.unknown())),
    provenance: provenanceSchema.optional(),
    truncated: z.boolean().optional(),
    warnings: z.array(z.string()).optional(),
  })
  .strict();

export function parseVisualizationDataset(input: unknown): VisualizationDataset {
  const parsed = visualizationDatasetSchema.safeParse(input);
  if (!parsed.success) {
    throw new VisualizationError('INVALID_SPEC', 'Dataset failed schema validation', {
      issues: parsed.error.issues,
    });
  }
  return parsed.data;
}
