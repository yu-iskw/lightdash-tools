/**
 * Redaction unit tests.
 */

import { describe, expect, it } from 'vitest';

import {
  maybeRedactEmail,
  normalizeScheduler,
  redactDestination,
  redactEmail,
  sanitizeSchedulerTarget,
  toGroupSummary,
  toOrgMemberSummary,
  toProjectMemberAccessSummary,
  toProjectSummary,
} from './redaction.js';

describe('organization-audit redaction', () => {
  it('redacts email local-part', () => {
    expect(redactEmail('alice@example.com')).toEqual({
      email: 'a***@example.com',
      domain: 'example.com',
      isExternalDomain: false,
    });
  });

  it('marks external domains when allowlist provided', () => {
    expect(redactEmail('bob@evil.example', ['example.com']).isExternalDomain).toBe(true);
  });

  it('returns full email when includeEmail is true', () => {
    expect(maybeRedactEmail('alice@example.com', true)).toBe('alice@example.com');
  });

  it('redacts non-email destinations', () => {
    const result = redactDestination('slack_channel', 'C0123456789');
    expect(result.redactedDestination).toMatch(/^C0/);
    expect(result.redactedDestination).not.toBe('C0123456789');
  });

  it('strips webhook secrets when revealDestinations is false', () => {
    const sanitized = sanitizeSchedulerTarget(
      {
        type: 'ms_teams',
        webhook: 'https://outlook.office.com/webhook/secret-token',
      },
      false,
    );
    expect(sanitized).not.toHaveProperty('webhook');
    expect(String(sanitized.redactedDestination)).toContain('outlook.office.com');
    expect(String(sanitized.redactedDestination)).not.toContain('secret-token');
  });

  it('does not spread raw google chat webhook URLs', () => {
    const normalized = normalizeScheduler(
      {
        schedulerUuid: 's1',
        targets: [
          {
            type: 'google_chat',
            googleChatWebhook: 'https://chat.googleapis.com/v1/spaces/AAA/messages?key=secret',
          },
        ],
      },
      false,
    );
    const target = (normalized.targets as Array<Record<string, unknown>>)[0];
    expect(target).not.toHaveProperty('googleChatWebhook');
    expect(JSON.stringify(normalized)).not.toContain('secret');
  });

  it('strips latestRun PII and opaque details', () => {
    const normalized = normalizeScheduler(
      {
        schedulerUuid: 's1',
        targets: [],
        latestRun: {
          runId: 'r1',
          createdByUserName: 'Alice Admin',
          createdByUserUuid: 'u1',
          details: { recipient: 'secret@evil.example' },
          runStatus: 'completed',
        },
      },
      false,
    );
    const latestRun = normalized.latestRun as Record<string, unknown>;
    expect(latestRun).not.toHaveProperty('createdByUserName');
    expect(latestRun).not.toHaveProperty('details');
    expect(latestRun.createdByUserUuid).toBe('u1');
  });
});

describe('toProjectSummary', () => {
  it('omits warehouse, dbt, and contact override fields', () => {
    const summary = toProjectSummary({
      projectUuid: 'p1',
      name: 'Prod',
      type: 'DEFAULT',
      organizationUuid: 'o1',
      createdByUserUuid: 'u1',
      createdByUserName: 'Alice',
      warehouseType: 'bigquery',
      warehouseConnection: {
        type: 'bigquery',
        password: 'warehouse-secret',
      },
      dbtConnection: {
        type: 'github',
        personal_access_token: 'ghp_secret_token',
      },
      schedulerFailureContactOverride: 'ops@example.com',
    });

    expect(summary).toEqual({
      projectUuid: 'p1',
      name: 'Prod',
      type: 'DEFAULT',
      organizationUuid: 'o1',
      createdByUserUuid: 'u1',
      warehouseType: 'bigquery',
    });
    expect(summary).not.toHaveProperty('warehouseConnection');
    expect(summary).not.toHaveProperty('dbtConnection');
    expect(summary).not.toHaveProperty('schedulerFailureContactOverride');
    expect(summary).not.toHaveProperty('createdByUserName');
    expect(JSON.stringify(summary)).not.toContain('secret');
    expect(JSON.stringify(summary)).not.toContain('ops@example.com');
  });

  it('falls back to warehouseConnection.type when warehouseType is absent', () => {
    const summary = toProjectSummary({
      projectUuid: 'p2',
      name: 'Pinned',
      type: 'DEFAULT',
      warehouseConnection: { type: 'snowflake', password: 'nope' },
      dbtConnection: { type: 'none' },
    });
    expect(summary.warehouseType).toBe('snowflake');
    expect(JSON.stringify(summary)).not.toContain('nope');
  });
});

describe('toProjectMemberAccessSummary', () => {
  it('redacts email by default and keeps names', () => {
    const row = toProjectMemberAccessSummary(
      {
        userUuid: 'u1',
        projectUuid: 'p1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'editor',
        roleUuid: 'r1',
      },
      false,
    );
    expect(row.firstName).toBe('Ada');
    expect(row.lastName).toBe('Lovelace');
    expect(row.email).toEqual({
      email: 'a***@example.com',
      domain: 'example.com',
      isExternalDomain: false,
    });
    expect(JSON.stringify(row)).not.toContain('ada@example.com');
  });

  it('returns full email when includeEmail is true', () => {
    const row = toProjectMemberAccessSummary(
      {
        userUuid: 'u1',
        projectUuid: 'p1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'viewer',
      },
      true,
    );
    expect(row.email).toBe('ada@example.com');
  });
});

describe('toGroupSummary', () => {
  it('allowlists group fields and redacts member emails', () => {
    const summary = toGroupSummary(
      {
        uuid: 'g1',
        name: 'Admins',
        organizationUuid: 'o1',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-02',
        createdByUserUuid: 'u0',
        updatedByUserUuid: 'u9',
        memberUuids: ['u1'],
        members: [
          {
            userUuid: 'u1',
            firstName: 'Ada',
            lastName: 'Lovelace',
            email: 'ada@example.com',
          },
        ],
        unexpectedSecret: 'should-drop',
      },
      false,
      ['example.com'],
    );
    expect(summary).toEqual({
      uuid: 'g1',
      name: 'Admins',
      organizationUuid: 'o1',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-02',
      createdByUserUuid: 'u0',
      memberUuids: ['u1'],
      members: [
        {
          userUuid: 'u1',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: {
            email: 'a***@example.com',
            domain: 'example.com',
            isExternalDomain: false,
          },
        },
      ],
    });
    expect(summary).not.toHaveProperty('updatedByUserUuid');
    expect(summary).not.toHaveProperty('unexpectedSecret');
  });
});

describe('toOrgMemberSummary', () => {
  it('redacts email and drops avatar fields', () => {
    const row = toOrgMemberSummary(
      {
        userUuid: 'u1',
        organizationUuid: 'o1',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@evil.example',
        isActive: true,
        isInviteExpired: false,
        role: 'admin',
        roleUuid: 'r1',
        avatarUrl: 'https://example.com/a.png',
        avatarGradient: 'g',
      },
      false,
      ['example.com'],
    );
    expect(row.email).toEqual({
      email: 'a***@evil.example',
      domain: 'evil.example',
      isExternalDomain: true,
    });
    expect(row).not.toHaveProperty('avatarUrl');
    expect(JSON.stringify(row)).not.toContain('ada@evil.example');
  });
});
