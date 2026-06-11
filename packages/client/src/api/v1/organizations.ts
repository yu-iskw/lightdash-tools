/**
 * Organizations API client.
 */

import { BaseApiClient } from '../base-client';

import type { Organization } from '@lightdash-tools/common';

export class OrganizationsClient extends BaseApiClient {
  /** Get the current user's organization. */
  async getCurrentOrganization(): Promise<Organization> {
    return this.http.get<Organization>('/org');
  }
}
