/**
 * Unit tests for binary download URL hostname SSRF guards.
 */

import { describe, expect, it } from 'vitest';

import { isBlockedBinaryHostname } from './http-client.js';

describe('isBlockedBinaryHostname', () => {
  it('blocks loopback and private IPv4 hosts', () => {
    expect(isBlockedBinaryHostname('localhost')).toBe(true);
    expect(isBlockedBinaryHostname('127.0.0.1')).toBe(true);
    expect(isBlockedBinaryHostname('10.0.0.1')).toBe(true);
    expect(isBlockedBinaryHostname('192.168.1.1')).toBe(true);
    expect(isBlockedBinaryHostname('172.16.0.1')).toBe(true);
    expect(isBlockedBinaryHostname('169.254.169.254')).toBe(true);
    expect(isBlockedBinaryHostname('metadata.google.internal')).toBe(true);
  });

  it('allows public hostnames', () => {
    expect(isBlockedBinaryHostname('cdn.example.com')).toBe(false);
    expect(isBlockedBinaryHostname('s3.amazonaws.com')).toBe(false);
  });
});
