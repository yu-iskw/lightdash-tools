/**
 * Safety assert unit tests.
 */

import { READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import { assertOrganizationAuditToolSafe } from './assert-safe.js';

describe('assertOrganizationAuditToolSafe', () => {
  it('accepts read-only GET tools', () => {
    expect(() =>
      assertOrganizationAuditToolSafe({
        shortName: 'list_org_members',
        annotations: READ_ONLY_DEFAULT,
        httpMethod: 'GET',
      }),
    ).not.toThrow();
  });

  it('rejects write annotations', () => {
    expect(() =>
      assertOrganizationAuditToolSafe({
        shortName: 'bad',
        annotations: WRITE_DESTRUCTIVE,
        httpMethod: 'GET',
      }),
    ).toThrow(/readOnlyHint/);
  });

  it('rejects warehouse query tools', () => {
    expect(() =>
      assertOrganizationAuditToolSafe({
        shortName: 'bad',
        annotations: READ_ONLY_DEFAULT,
        httpMethod: 'GET',
        executesWarehouseQuery: true,
      }),
    ).toThrow(/warehouse/);
  });
});
