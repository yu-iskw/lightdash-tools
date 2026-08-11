/**
 * Zod schemas for LVS v1.
 */

import { z } from 'zod';

import { LVS_VERSION } from './types';

const intentTypeSchema = z.enum(['overview', 'rank', 'executive-summary']);

const metricQueryFiltersSchema = z
  .object({
    dimensions: z.unknown().optional(),
    metrics: z.unknown().optional(),
  })
  .strict();

const metricQuerySchema = z
  .object({
    dimensions: z.array(z.string().min(1)),
    metrics: z.array(z.string().min(1)).min(1),
    filters: metricQueryFiltersSchema.optional(),
    sorts: z
      .array(
        z.object({
          fieldId: z.string().min(1),
          descending: z.boolean(),
          nullsFirst: z.boolean().optional(),
        }),
      )
      .optional(),
    limit: z.number().int().positive().optional(),
  })
  .strict();

const rolesSchema = z
  .object({
    category: z.string().min(1).optional(),
    value: z.string().min(1).optional(),
    secondaryValue: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
  })
  .strict()
  .refine((roles) => Object.values(roles).some((v) => typeof v === 'string'), {
    message: 'At least one field role binding is required',
  });

const rankedCardsOptionsSchema = z
  .object({
    maxRows: z.number().int().positive().max(50).optional(),
    sortDescending: z.boolean().optional(),
  })
  .strict();

const templateVisualizationSchema = z.discriminatedUnion('template', [
  z
    .object({
      type: z.literal('template'),
      template: z.literal('metric-hero'),
    })
    .strict(),
  z
    .object({
      type: z.literal('template'),
      template: z.literal('ranked-cards'),
      options: rankedCardsOptionsSchema.optional(),
    })
    .strict(),
]);

const capabilitySchema = z.enum([
  'tooltip',
  'selection',
  'multiSelection',
  'filter',
  'rerunQuery',
  'inspect',
  'openContent',
  'crossFilter',
  'drillDown',
  'underlyingData',
  'animation',
  'responsiveLayout',
]);

export const visualizationSpecV1Schema = z
  .object({
    version: z.literal(LVS_VERSION),
    metadata: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .strict()
      .optional(),
    intent: z
      .object({
        type: intentTypeSchema,
        audience: z.string().optional(),
        message: z.string().optional(),
      })
      .strict()
      .optional(),
    data: z
      .object({
        source: z
          .object({
            type: z.literal('metricQuery'),
            explore: z.string().min(1),
          })
          .strict(),
        query: metricQuerySchema,
        roles: rolesSchema,
      })
      .strict(),
    visual: templateVisualizationSchema,
    emphasis: z
      .object({
        mode: z.enum(['max', 'min', 'none']),
        field: z.string().optional(),
      })
      .strict()
      .optional(),
    interaction: z
      .object({
        tooltip: z.boolean().optional(),
        selection: z
          .object({
            type: z.enum(['single', 'multiple']),
            field: z.string().min(1),
          })
          .strict()
          .optional(),
        actions: z
          .array(
            z
              .object({
                trigger: z.literal('selection'),
                action: z
                  .object({
                    type: z.enum(['filter', 'rerunQuery', 'inspect', 'openContent']),
                    filterField: z.string().optional(),
                  })
                  .strict(),
              })
              .strict(),
          )
          .optional(),
      })
      .strict()
      .optional(),
    theme: z
      .object({
        name: z.literal('lightdash').optional(),
        appearance: z.enum(['light', 'dark', 'system']).optional(),
      })
      .strict()
      .optional(),
    accessibility: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .strict()
      .optional(),
    capabilities: z
      .object({
        required: z.array(capabilitySchema).optional(),
        preferred: z.array(capabilitySchema).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
