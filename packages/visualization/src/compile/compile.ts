/**
 * Public compilation entrypoint.
 */

import { VisualizationError } from '../errors';
import { validateVisualizationSpec } from '../spec/validate';
import { compileCustomChart } from '../targets/custom-chart/compile';
import { renderHtml } from '../targets/html/render';
import { renderSvg } from '../targets/svg/render';
import { getTemplate } from '../templates/registry';
import { resolveTheme } from '../theme/lightdash';

import { bindRoles } from './bind';
import { negotiateCapabilities } from './capability';

import type { VisualizationDataset } from '../data/dataset';
import type { VisualizationWarning } from '../errors';
import type { CompileTarget } from './capability';
import type { LayoutDocument } from '../layout/types';
import type { VisualizationSpecV1 } from '../spec/types';
import type { CustomChartCompileResult } from '../targets/custom-chart/compile';

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
  layout?: LayoutDocument;
  svg?: string;
  html?: string;
  customChart?: CustomChartCompileResult;
  validatedSpec: VisualizationSpecV1;
}

export function compileVisualization(input: CompileVisualizationInput): CompileVisualizationResult {
  const spec = validateVisualizationSpec(input.spec);

  if (spec.visual.type === 'vegaLite') {
    throw new VisualizationError(
      'VEGA_LITE_ESCAPE_HATCH_BANNED',
      'type: vegaLite is banned on governed compile paths in MVP; use a template',
    );
  }

  const template = getTemplate(spec.visual.template);
  if (!template.supportedTargets.includes(input.target)) {
    throw new VisualizationError(
      'TEMPLATE_TARGET_UNSUPPORTED',
      `Template "${template.id}" does not support target "${input.target}"`,
      { templateId: template.id, target: input.target },
    );
  }

  if (input.dataset.rows.length > template.maxRows * 5) {
    throw new VisualizationError(
      'DATASET_TOO_LARGE',
      `Dataset has ${input.dataset.rows.length} rows; template "${template.id}" max guidance is ${template.maxRows}`,
      { rowCount: input.dataset.rows.length, maxRows: template.maxRows },
    );
  }

  const capability = negotiateCapabilities({
    target: input.target,
    interaction: spec.interaction,
    capabilities: spec.capabilities,
    strict: input.strict,
  });

  const boundRoles = bindRoles(spec.data.roles, input.dataset, template.requirements);
  const theme = resolveTheme();
  const compiled = template.compile({
    spec,
    dataset: input.dataset,
    boundRoles,
    theme,
    target: input.target,
  });

  const warnings = [...capability.warnings, ...compiled.warnings];
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
    layout: compiled.layout,
    validatedSpec: spec,
  };

  switch (input.target) {
    case 'svg':
      result.svg = renderSvg(compiled.layout);
      break;
    case 'standalone-html':
      result.html = renderHtml(compiled.layout, {
        embedData: input.embedData === true,
        dataset: input.dataset,
      });
      result.svg = renderSvg(compiled.layout);
      break;
    case 'lightdash-custom-chart':
      result.customChart = compileCustomChart({
        spec,
        dataset: input.dataset,
        boundRoles,
        templateId: template.id,
      });
      warnings.push(...result.customChart.warnings);
      break;
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
