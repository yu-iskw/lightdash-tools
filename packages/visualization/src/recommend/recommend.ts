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

function scoreMetricHero(
  rowCount: number,
  numericCount: number,
): Pick<TemplateRecommendation, 'missingRoles' | 'reasons' | 'score'> {
  if (rowCount <= 1 && numericCount >= 1) {
    return { score: 50, reasons: ['Single-row quantitative dataset'], missingRoles: [] };
  }
  return { score: 0, reasons: [], missingRoles: ['value'] };
}

function scoreRankedCards(
  rowCount: number,
  numericCount: number,
  stringCount: number,
): Pick<TemplateRecommendation, 'missingRoles' | 'reasons' | 'score'> {
  if (stringCount >= 1 && numericCount >= 1 && rowCount >= 2) {
    return {
      score: 50,
      reasons: ['Categorical + quantitative multi-row dataset'],
      missingRoles: [],
    };
  }
  const missingRoles: string[] = [];
  if (stringCount < 1) missingRoles.push('category');
  if (numericCount < 1) missingRoles.push('value');
  return { score: 0, reasons: [], missingRoles };
}

export function recommendVisualization(input: {
  dataset: VisualizationDataset;
  intent?: VisualizationIntentType;
}): TemplateRecommendation[] {
  const numericCols = input.dataset.columns.filter((c) => c.dataType === 'number');
  const stringCols = input.dataset.columns.filter((c) => c.dataType === 'string');
  const rowCount = input.dataset.rows.length;

  return listTemplates()
    .map((template) => {
      let score = 0;
      const reasons: string[] = [];
      if (input.intent && template.intents.includes(input.intent)) {
        score += 40;
        reasons.push(`Matches intent ${input.intent}`);
      }

      const shape =
        template.id === 'metric-hero'
          ? scoreMetricHero(rowCount, numericCols.length)
          : scoreRankedCards(rowCount, numericCols.length, stringCols.length);

      return {
        templateId: template.id,
        score: score + shape.score,
        reasons: [...reasons, ...shape.reasons],
        missingRoles: shape.missingRoles,
      };
    })
    .sort((a, b) => b.score - a.score);
}
