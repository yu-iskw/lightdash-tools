import { describe, expect, it } from 'vitest';

import {
  matchInvokeOrigin,
  originFromHostHeader,
  parseInvokeOrigins,
  requestProtocol,
} from './invoke-origins.js';

import type { IncomingMessage } from 'node:http';

const ILB = 'http://mcp.ilb.internal';

describe('parseInvokeOrigins', () => {
  it('returns empty when unset or blank', () => {
    expect(parseInvokeOrigins(undefined, 'https://mcp.example.com')).toEqual([]);
    expect(parseInvokeOrigins('  ', 'https://mcp.example.com')).toEqual([]);
  });

  it('parses comma-separated http(s) origins and skips the public URL', () => {
    const parsed = parseInvokeOrigins(
      ` ${ILB}, https://mcp.example.com, http://other.internal:8080 `,
      'https://mcp.example.com',
    );
    expect(parsed.map((origin) => origin.origin)).toEqual([
      'http://mcp.ilb.internal',
      'http://other.internal:8080',
    ]);
  });

  it('strips default ports so http://host:80 matches http://host', () => {
    const parsed = parseInvokeOrigins('http://mcp.ilb.internal:80', 'https://mcp.example.com');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.origin).toBe(ILB);
  });

  it('rejects a path, query, fragment, or non-http scheme', () => {
    expect(() =>
      parseInvokeOrigins('http://mcp.ilb.internal/v1', 'https://mcp.example.com'),
    ).toThrow(/without a path/);
    expect(() => parseInvokeOrigins('not-a-url', 'https://mcp.example.com')).toThrow(
      /absolute http\(s\) origins/,
    );
    expect(() => parseInvokeOrigins('ftp://mcp.ilb.internal', 'https://mcp.example.com')).toThrow(
      /absolute http\(s\) origins/,
    );
  });
});

describe('originFromHostHeader / matchInvokeOrigin', () => {
  const invokeOrigins = parseInvokeOrigins(ILB, 'https://mcp.example.com');

  it('matches Host + http scheme to the listed origin', () => {
    expect(matchInvokeOrigin('mcp.ilb.internal', 'http', invokeOrigins)?.origin).toBe(ILB);
  });

  it('does not match the same hostname on a different port', () => {
    expect(matchInvokeOrigin('mcp.ilb.internal:9999', 'http', invokeOrigins)).toBeUndefined();
  });

  it('does not match https when the listed origin is http', () => {
    expect(matchInvokeOrigin('mcp.ilb.internal', 'https', invokeOrigins)).toBeUndefined();
  });

  it('does not match the public hostname', () => {
    expect(matchInvokeOrigin('mcp.example.com', 'https', invokeOrigins)).toBeUndefined();
  });

  it('does not parse Host when the extra-origin list is empty', () => {
    expect(matchInvokeOrigin('mcp.ilb.internal', 'http', [])).toBeUndefined();
  });

  it('treats non-https protocol as http', () => {
    expect(originFromHostHeader('mcp.ilb.internal', 'http')?.origin).toBe(ILB);
    expect(originFromHostHeader('mcp.ilb.internal', 'bogus')?.origin).toBe(ILB);
  });
});

describe('requestProtocol', () => {
  it('prefers the first X-Forwarded-Proto value', () => {
    expect(
      requestProtocol({
        headers: { 'x-forwarded-proto': 'https, http' },
        socket: {},
      } as unknown as IncomingMessage),
    ).toBe('https');
    expect(
      requestProtocol({
        headers: { 'x-forwarded-proto': 'http' },
        socket: { encrypted: true },
      } as unknown as IncomingMessage),
    ).toBe('http');
  });

  it('falls back to TLS then http', () => {
    expect(
      requestProtocol({
        headers: {},
        socket: { encrypted: true },
      } as unknown as IncomingMessage),
    ).toBe('https');
    expect(
      requestProtocol({
        headers: {},
        socket: {},
      } as unknown as IncomingMessage),
    ).toBe('http');
  });
});
