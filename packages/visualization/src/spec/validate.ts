/**
 * Validate LVS documents.
 */

import { VisualizationError } from '../errors';

import { visualizationSpecV1Schema } from './schema';

import type { VisualizationSpecV1 } from './types';

export function validateVisualizationSpec(input: unknown): VisualizationSpecV1 {
  const parsed = visualizationSpecV1Schema.safeParse(input);
  if (!parsed.success) {
    const version =
      input && typeof input === 'object' && 'version' in input
        ? (input as { version?: unknown }).version
        : undefined;
    if (version !== undefined && version !== '1') {
      throw new VisualizationError(
        'UNSUPPORTED_SPEC_VERSION',
        `Unsupported LVS version: ${String(version)}`,
        { issues: parsed.error.issues },
      );
    }
    throw new VisualizationError('INVALID_SPEC', 'LVS document failed schema validation', {
      issues: parsed.error.issues,
    });
  }
  return parsed.data as VisualizationSpecV1;
}
