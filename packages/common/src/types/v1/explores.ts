/**
 * Explores domain models (list and get response types from the Lightdash v1 API).
 */

import type { components } from '../generated/openapi-types';

export namespace Explores {
  /** List explores response (array of summary explore). */
  export type ApiExploresResults = components['schemas']['ApiExploresResults'];
  /** Get single explore response (full explore). */
  export type ApiExploreResults = components['schemas']['ApiExploreResults'];
  /** Compiled table within an explore. */
  export type CompiledTable = components['schemas']['CompiledTable'];
}
