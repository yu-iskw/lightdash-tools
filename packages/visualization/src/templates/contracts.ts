import type { TemplateRoleRequirements } from '../compile/bind';
import type { CompileTarget } from '../compile/capability';
import type { VisualizationDataset } from '../data/dataset';
import type { VisualizationWarning } from '../errors';
import type { LayoutDocument } from '../layout/types';
import type { FieldRoleMap, VisualizationIntentType, VisualizationSpecV1 } from '../spec/types';
import type { CustomChartCompileResult } from '../targets/custom-chart/compile';

export type TemplateId = 'metric-hero' | 'ranked-cards';

export interface TemplateCompileContext {
  spec: VisualizationSpecV1;
  dataset: VisualizationDataset;
  boundRoles: FieldRoleMap;
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
  /** Optional: templates that support lightdash-custom-chart implement this. */
  compileCustomChart?(context: TemplateCompileContext): CustomChartCompileResult;
}
