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
