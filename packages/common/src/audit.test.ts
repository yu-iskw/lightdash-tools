import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  auditSeverityForStatus,
  buildAuditLogEntry,
  closeAuditLog,
  getSessionId,
  initAuditLog,
  logAuditEntry,
} from './audit';

describe('audit', () => {
  const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

  afterEach(() => {
    stderrSpy.mockClear();
  });

  it('getSessionId returns a stable UUID for the process', () => {
    expect(getSessionId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(getSessionId()).toBe(getSessionId());
  });

  it('auditSeverityForStatus maps statuses for Cloud Logging', () => {
    expect(auditSeverityForStatus('success')).toBe('INFO');
    expect(auditSeverityForStatus('deletion_succeeded')).toBe('NOTICE');
    expect(auditSeverityForStatus('blocked')).toBe('WARNING');
    expect(auditSeverityForStatus('error')).toBe('ERROR');
  });

  it('buildAuditLogEntry derives channel, severity, and message', () => {
    const entry = buildAuditLogEntry({
      tool: 'demo_tool',
      status: 'blocked',
      startMs: Date.now() - 5,
      projectUuids: [],
      profileId: 'semantic-layer',
    });
    expect(entry.channel).toBe('audit');
    expect(entry.severity).toBe('WARNING');
    expect(entry.message).toBe('demo_tool blocked');
    expect(entry.projectUuids).toBeUndefined();
    expect(entry.profileId).toBe('semantic-layer');
    expect(entry.sessionId).toBe(getSessionId());
  });

  it('initAuditLog announces stderr destination on stdout when no file path is given', () => {
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      initAuditLog();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[audit] Writing to stderr'),
      );
    } finally {
      consoleLogSpy.mockRestore();
    }
  });

  it('logAuditEntry writes pure JSON NDJSON to stderr (Cloud Logging–parseable)', () => {
    initAuditLog();

    logAuditEntry(
      buildAuditLogEntry({
        tool: 'test_tool',
        status: 'success',
        startMs: Date.now() - 12,
        tokenHash: 'abc123',
        subject: 'user-uuid',
        clientSessionId: 'mcp-session-1',
        profileId: 'semantic-layer',
      }),
    );

    const auditLine = stderrSpy.mock.calls
      .map(([chunk]) => String(chunk))
      .find((line) => line.includes('"tool":"test_tool"'));
    expect(auditLine).toBeDefined();
    expect(auditLine).not.toContain('[audit]');
    const parsed = JSON.parse(auditLine!.trim()) as Record<string, unknown>;
    expect(parsed.channel).toBe('audit');
    expect(parsed.severity).toBe('INFO');
    expect(parsed.message).toBe('test_tool success');
    expect(parsed.status).toBe('success');
    expect(parsed.tokenHash).toBe('abc123');
    expect(parsed.subject).toBe('user-uuid');
    expect(parsed.clientSessionId).toBe('mcp-session-1');
    expect(parsed.profileId).toBe('semantic-layer');
  });

  it('logAuditEntry appends to a file when initAuditLog receives a path', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'audit-test-'));
    const filePath = join(dir, 'audit.ndjson');

    try {
      initAuditLog(filePath);

      logAuditEntry(
        buildAuditLogEntry({
          tool: 'file_tool',
          status: 'blocked',
          startMs: Date.now() - 3,
          projectUuids: ['uuid-a'],
        }),
      );

      await closeAuditLog();

      // filePath is a temp path from mkdtempSync in this test only
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const contents = readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(contents.trim()) as Record<string, unknown>;
      expect(parsed.channel).toBe('audit');
      expect(parsed.tool).toBe('file_tool');
      expect(parsed.projectUuids).toEqual(['uuid-a']);
      expect(parsed.status).toBe('blocked');
    } finally {
      await closeAuditLog();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
