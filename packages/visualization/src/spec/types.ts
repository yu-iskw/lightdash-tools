/**
 * LVS v1 TypeScript types (normative shapes; Zod is the runtime validator).
 */

export const LVS_VERSION = '1' as const;

export type VisualizationIntentType = 'executive-summary' | 'overview' | 'rank';

export interface VisualizationMetadata {
  title?: string;
  description?: string;
}

export interface VisualizationIntent {
  type: VisualizationIntentType;
  audience?: string;
  /** Display-only narrative. Compilers MUST NOT distort values to match it. */
  message?: string;
}

export interface MetricQueryDataSource {
  type: 'metricQuery';
  explore: string;
}

/** Matches ADR-0020 / run_metric_query filter groups (dimensions/metrics only). */
export interface VisualizationMetricQueryFilters {
  dimensions?: unknown;
  metrics?: unknown;
}

export interface VisualizationMetricQuery {
  dimensions: string[];
  metrics: string[];
  filters?: VisualizationMetricQueryFilters;
  sorts?: Array<{
    fieldId: string;
    descending: boolean;
    nullsFirst?: boolean;
  }>;
  limit?: number;
}

export type FieldRole = 'category' | 'description' | 'label' | 'secondaryValue' | 'value';

export type FieldRoleMap = Partial<Record<FieldRole, string>>;

export interface VisualizationDataBinding {
  source: MetricQueryDataSource;
  query: VisualizationMetricQuery;
  roles: FieldRoleMap;
}

export interface RankedCardsOptions {
  maxRows?: number;
  sortDescending?: boolean;
}

export type TemplateVisualization =
  | {
      type: 'template';
      template: 'metric-hero';
    }
  | {
      type: 'template';
      template: 'ranked-cards';
      options?: RankedCardsOptions;
    };

/**
 * Vega-Lite escape hatch exists in the type space for future CLI-only use,
 * but governed compile targets reject it in MVP (see compileVisualization).
 */
export interface VegaLiteVisualization {
  type: 'vegaLite';
  spec: Record<string, unknown>;
}

export type VisualizationDefinition = TemplateVisualization | VegaLiteVisualization;

export interface VisualizationEmphasis {
  mode: 'max' | 'min' | 'none';
  field?: string;
}

export type VisualizationActionType = 'filter' | 'inspect' | 'openContent' | 'rerunQuery';

export interface VisualizationActionBinding {
  trigger: 'selection';
  action: {
    type: VisualizationActionType;
    filterField?: string;
  };
}

export interface VisualizationInteraction {
  tooltip?: boolean;
  selection?: {
    type: 'multiple' | 'single';
    field: string;
  };
  actions?: VisualizationActionBinding[];
}

export interface ThemeReference {
  name?: 'lightdash';
  appearance?: 'dark' | 'light' | 'system';
}

export interface AccessibilitySpec {
  title?: string;
  description?: string;
}

export type VisualizationCapability =
  | 'animation'
  | 'crossFilter'
  | 'drillDown'
  | 'filter'
  | 'inspect'
  | 'multiSelection'
  | 'openContent'
  | 'rerunQuery'
  | 'responsiveLayout'
  | 'selection'
  | 'tooltip'
  | 'underlyingData';

export interface VisualizationCapabilitiesSpec {
  required?: VisualizationCapability[];
  preferred?: VisualizationCapability[];
}

export interface VisualizationSpecV1 {
  version: typeof LVS_VERSION;
  metadata?: VisualizationMetadata;
  intent?: VisualizationIntent;
  data: VisualizationDataBinding;
  visual: VisualizationDefinition;
  emphasis?: VisualizationEmphasis;
  interaction?: VisualizationInteraction;
  theme?: ThemeReference;
  accessibility?: AccessibilitySpec;
  capabilities?: VisualizationCapabilitiesSpec;
}
