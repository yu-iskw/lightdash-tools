import type { components } from '../generated/openapi-types';

export namespace Tags {
  export type ApiGetTagsResponse = components['schemas']['ApiGetTagsResponse'];
  // ApiGetTagResponse is missing from current spec, using a placeholder based on pattern
  export type ApiGetTagResponse = {
    results: components['schemas']['Tag'];
    status: 'ok';
  };
  export type Tag = components['schemas']['Tag'];
}
