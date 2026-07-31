import type { components } from '../generated/openapi-types';

/** Runtime values for OpenAPI ContentSortByColumns (MCP Zod + client). */
export const CONTENT_SORT_BY_COLUMNS = [
  'last_updated_at',
  'name',
  'space_name',
  'views',
] as const satisfies readonly components['schemas']['ContentSortByColumns'][];

export namespace Content {
  export type ApiContentResponse = components['schemas']['ApiContentResponse'];
  export type ContentType = components['schemas']['ContentType'];
  export type ContentSortByColumns = components['schemas']['ContentSortByColumns'];
}
