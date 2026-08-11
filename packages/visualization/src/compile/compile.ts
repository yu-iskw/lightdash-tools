import { VisualizationError } from '../errors';
import { validateVisualizationSpec } from '../spec/validate';
import { renderHtml } from '../targets/html/render';
import { renderSvg } from '../targets/svg/render';
import { resolveRankedCardsMaxRows } from '../templates/ranked-cards';
import { getTemplate } from '../templates/registry';

import { bindRoles } from './bind';
import { negotiateCapabilities } from './capability';

import type { VisualizationDataset } from '../data/dataset';
import type { VisualizationWarning } from '../errors';
import type { CompileTarget } from './capability';
import type { FieldRole, FieldRoleMap, VisualizationSpecV1 } from '../spec/types';
import type { CustomChartCompileResult } from '../targets/custom-chart/compile';
import type { VisualizationTemplate } from '../templates/contracts';

const DATASET_HARD_LIMIT_MULTIPLIER = 5;

export interface CompileVisualizationInput {
  spec: unknown;
  dataset: VisualizationDataset;
  target: CompileTarget;
  strict?: boolean;
  /** HTML only: embed dataset rows (default false). */
  embedData?: boolean;
}

export interface CompileVisualizationResult {
  target: CompileTarget;
  templateId?: string;
  warnings: VisualizationWarning[];
  capability: {
    supported: string[];
    degraded: string[];
  };
  svg?: string;
  html?: string;
  customChart?: CustomChartCompileResult;
  validatedSpec: VisualizationSpecV1;
}

/** Presentation top-N: template default, overridden by ranked-cards options.maxRows when set. */
function resolvePresentationMaxRows(
  spec: VisualizationSpecV1,
  template: VisualizationTemplate,
): number {
  if (spec.visual.type === 'template' && spec.visual.template === 'ranked-cards') {
    return resolveRankedCardsMaxRows(spec, template.maxRows);
  }
  return template.maxRows;
}

/** Bound role fields must appear in the LVS query so live Custom Chart re-query returns them. */
function assertRolesInQuery(boundRoles: FieldRoleMap, spec: VisualizationSpecV1): void {
  const queryFields = new Set([...spec.data.query.dimensions, ...spec.data.query.metrics]);
  for (const [role, fieldId] of Object.entries(boundRoles) as Array<
    [FieldRole, string | undefined]
  >) {
    if (!fieldId) continue;
    if (!queryFields.has(fieldId)) {
      throw new VisualizationError(
        'INVALID_SPEC',
        `Role "${role}" field "${fieldId}" must appear in data.query.dimensions or data.query.metrics`,
        {
          role,
          fieldId,
          dimensions: spec.data.query.dimensions,
          metrics: spec.data.query.metrics,
        },
      );
    }
  }
}

export function compileVisualization(input: CompileVisualizationInput): CompileVisualizationResult {
  const spec = validateVisualizationSpec(input.spec);
  const template = getTemplate(spec.visual.template);
  if (!template.supportedTargets.includes(input.target)) {
    throw new VisualizationError(
      'TEMPLATE_TARGET_UNSUPPORTED',
      `Template "${template.id}" does not support target "${input.target}"`,
      { templateId: template.id, target: input.target },
    );
  }

  const presentationMaxRows = resolvePresentationMaxRows(spec, template);
  if (input.dataset.rows.length > presentationMaxRows * DATASET_HARD_LIMIT_MULTIPLIER) {
    const hardLimit = presentationMaxRows * DATASET_HARD_LIMIT_MULTIPLIER;
    throw new VisualizationError(
      'DATASET_TOO_LARGE',
      `Dataset has ${input.dataset.rows.length} rows; hard limit is ${hardLimit} (${DATASET_HARD_LIMIT_MULTIPLIER}× presentation maxRows ${presentationMaxRows})`,
      {
        rowCount: input.dataset.rows.length,
        maxRows: presentationMaxRows,
        hardLimit,
      },
    );
  }

  const capability = negotiateCapabilities({
    target: input.target,
    interaction: spec.interaction,
    capabilities: spec.capabilities,
    strict: input.strict,
  });

  const boundRoles = bindRoles(spec.data.roles, input.dataset, template.requirements);
  assertRolesInQuery(boundRoles, spec);
  const ctx = { spec, dataset: input.dataset, boundRoles };

  const warnings: VisualizationWarning[] = [...capability.warnings];
  if (input.dataset.truncated) {
    warnings.push({
      code: 'DATA_TRUNCATED',
      message: 'Input dataset marked truncated',
    });
  }

  const result: CompileVisualizationResult = {
    target: input.target,
    templateId: template.id,
    warnings,
    capability: {
      supported: capability.supported,
      degraded: capability.degraded,
    },
    validatedSpec: spec,
  };

  switch (input.target) {
    case 'svg':
    case 'standalone-html': {
      const compiled = template.compile(ctx);
      warnings.push(...compiled.warnings);
      if (input.target === 'svg') {
        result.svg = renderSvg(compiled.layout);
      } else {
        result.html = renderHtml(compiled.layout, {
          embedData: input.embedData === true,
          dataset: input.dataset,
        });
      }
      break;
    }
    case 'lightdash-custom-chart': {
      // Registry asserts supportedTargets ↔ compileCustomChart consistency at load.
      result.customChart = template.compileCustomChart!(ctx);
      warnings.push(...result.customChart.warnings);
      break;
    }
    default: {
      const _exhaustive: never = input.target;
      throw new VisualizationError(
        'UNSUPPORTED_TARGET',
        `Unsupported target: ${String(_exhaustive)}`,
      );
    }
  }

  return result;
}
