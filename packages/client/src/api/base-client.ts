/**
 * Base pattern for API area clients. Each area (projects, organizations, charts, etc.)
 * receives the shared HttpClient and implements typed methods for its endpoints.
 */

import type { HttpClient } from '../http/http-client';

/**
 * Base for API area clients. Subclasses receive the shared HTTP client
 * and implement methods that call this.http.get/post/put/patch/delete with typed paths and responses.
 */
export abstract class BaseApiClient {
  constructor(protected readonly http: HttpClient) {}
}
