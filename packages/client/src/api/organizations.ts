/**
 * Organizations API client.
 */

import type { Organization } from '@lightdash-ai/common';
import { BaseApiClient } from './base-client';

export class OrganizationsClient extends BaseApiClient {
  /** Get the current user's organization. */
  async getCurrentOrganization(): Promise<Organization> {
    return this.http.get<Organization>('/org');
  }
}
