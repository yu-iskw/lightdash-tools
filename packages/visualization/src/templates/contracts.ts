/**
 * Template contracts and registry.
 */

import type { VisualizationDataset } from '../data/dataset';
import type { LayoutDocument } from '../layout/types';
import type { TemplateRoleRequirements } from '../compile/bind';
import type { CompileTarget } from '../compile/capability';
import type {
  MetricHeroOptions,
  RankedCardsOptions,
  VisualizationIntentType,
  VisualizationSpecV1,
} from '../spec/types';
import type { VisualizationTheme } from '../theme/lightdash';
import type { VisualizationWarning } from '../errors';

export type TemplateId = 'metric-hero' | 'ranked-cards';

export interface TemplateCompileContext {
  spec: VisualizationSpecV1;
  dataset: VisualizationDataset;
  boundRoles: Partial<Record<string, string>>;
  theme: VisualizationTheme;
  target: CompileTarget;
}

export interface TemplateCompileOutput {
  layout: LayoutDocument;
  warnings: VisualizationWarning[];
}

export interface VisualizationTemplate {
  id: TemplateId;
  version: string;
  title: string;
  description: string;
  intents: VisualizationIntentType[];
  requirements: TemplateRoleRequirements;
  supportedTargets: CompileTarget[];
  maxRows: number;
  compile(context: TemplateCompileContext): TemplateCompileOutput;
}

export type TemplateOptions = MetricHeroOptions | RankedCardsOptions | undefined;
