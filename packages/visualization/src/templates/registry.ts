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
