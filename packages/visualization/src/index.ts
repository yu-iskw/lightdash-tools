export { LVS_VERSION } from './spec/types';
export type {
  VisualizationSpecV1,
  VisualizationIntentType,
  VisualizationDefinition,
  VisualizationCapability,
  FieldRole,
  TemplateVisualization,
} from './spec/types';
export { visualizationSpecV1Schema } from './spec/schema';
export { validateVisualizationSpec } from './spec/validate';

export type {
  VisualizationDataset,
  VisualizationColumn,
  VisualizationRow,
  DatasetProvenance,
} from './data/dataset';
export { parseVisualizationDataset, visualizationDatasetSchema } from './data/dataset';

export { VisualizationError } from './errors';
export type {
  VisualizationErrorCode,
  VisualizationWarning,
  VisualizationWarningCode,
} from './errors';

export type { CompileTarget } from './compile/capability';
export {
  COMPILE_TARGETS,
  capabilitiesForTarget,
  isCompileTarget,
  negotiateCapabilities,
} from './compile/capability';
export { compileVisualization } from './compile/compile';
export type { CompileVisualizationInput, CompileVisualizationResult } from './compile/compile';

export { listTemplates, getTemplate } from './templates/registry';
export type { TemplateId, VisualizationTemplate } from './templates/contracts';

export { recommendVisualization } from './recommend/recommend';
export type { TemplateRecommendation } from './recommend/recommend';

export type { CustomChartCompileResult } from './targets/custom-chart/compile';
