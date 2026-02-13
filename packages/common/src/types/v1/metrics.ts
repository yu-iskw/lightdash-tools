import type { components } from '../generated/openapi-types';

export namespace Metrics {
  export type ApiMetricsCatalog = components['schemas']['ApiMetricsCatalog'];
  export type ApiGetMetricResponse = components['schemas']['ApiGetMetricPeek'];
  export type CompiledMetric = components['schemas']['CompiledMetric'];
}
