/**
 * Trivial deterministic recommendation from dataset shape.
 */

import { listTemplates } from '../templates/registry';

import type { VisualizationDataset } from '../data/dataset';
import type { VisualizationIntentType } from '../spec/types';

export interface TemplateRecommendation {
  templateId: string;
  score: number;
  reasons: string[];
  missingRoles: string[];
}

export function recommendVisualization(input: {
  dataset: VisualizationDataset;
  intent?: VisualizationIntentType;
}): TemplateRecommendation[] {
  const numericCols = input.dataset.columns.filter((c) => c.dataType === 'number');
  const stringCols = input.dataset.columns.filter((c) => c.dataType === 'string');
  const rowCount = input.dataset.rows.length;
  const results: TemplateRecommendation[] = [];

  for (const template of listTemplates()) {
    const reasons: string[] = [];
    let score = 0;
    const missingRoles: string[] = [];

    if (input.intent && template.intents.includes(input.intent)) {
      score += 40;
      reasons.push(`Matches intent ${input.intent}`);
    }

    if (template.id === 'metric-hero') {
      if (rowCount <= 1 && numericCols.length >= 1) {
        score += 50;
        reasons.push('Single-row quantitative dataset');
      } else {
        missingRoles.push('value');
      }
    }

    if (template.id === 'ranked-cards') {
      if (stringCols.length >= 1 && numericCols.length >= 1 && rowCount >= 2) {
        score += 50;
        reasons.push('Categorical + quantitative multi-row dataset');
      } else {
        if (stringCols.length < 1) missingRoles.push('category');
        if (numericCols.length < 1) missingRoles.push('value');
      }
    }

    results.push({
      templateId: template.id,
      score,
      reasons,
      missingRoles,
    });
  }

  return results.sort((a, b) => b.score - a.score);
}
