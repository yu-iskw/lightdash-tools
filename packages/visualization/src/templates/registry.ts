/**
 * Template registry.
 */

import { VisualizationError } from '../errors';

import { metricHeroTemplate } from './metric-hero';
import { rankedCardsTemplate } from './ranked-cards';

import type { TemplateId, VisualizationTemplate } from './contracts';

const TEMPLATES: Record<TemplateId, VisualizationTemplate> = {
  'metric-hero': metricHeroTemplate,
  'ranked-cards': rankedCardsTemplate,
};

for (const template of Object.values(TEMPLATES)) {
  const claimsCustomChart = template.supportedTargets.includes('lightdash-custom-chart');
  const hasCompiler = typeof template.compileCustomChart === 'function';
  if (claimsCustomChart !== hasCompiler) {
    throw new Error(
      `Template "${template.id}" custom-chart support mismatch (supportedTargets vs compileCustomChart)`,
    );
  }
}

export function listTemplates(): VisualizationTemplate[] {
  return Object.values(TEMPLATES);
}

export function getTemplate(id: TemplateId | string): VisualizationTemplate {
  if (!(id in TEMPLATES)) {
    throw new VisualizationError('UNKNOWN_TEMPLATE', `Unknown template "${id}"`, {
      templateId: id,
      known: Object.keys(TEMPLATES),
    });
  }
  return TEMPLATES[id as TemplateId];
}
