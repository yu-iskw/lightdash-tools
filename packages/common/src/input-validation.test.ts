import { describe, it, expect } from 'vitest';

import {
  rejectControlChars,
  validateFingerprint,
  validateResourceId,
  validateSafeOutputDir,
  validateSlug,
  validateUuid,
} from './input-validation';

describe('input-validation', () => {
  describe('rejectControlChars', () => {
    it('accepts empty string', () => {
      expect(rejectControlChars('')).toBe('');
    });

    it('accepts clean ASCII strings', () => {
      expect(rejectControlChars('hello')).toBe('hello');
      expect(rejectControlChars('project-123')).toBe('project-123');
      expect(rejectControlChars('a b c')).toBe('a b c');
    });

    it('throws on null character', () => {
      expect(() => rejectControlChars('x\u0000y')).toThrow(
        'Input contains invalid control characters',
      );
    });

    it('throws on newline in user string', () => {
      expect(() => rejectControlChars('x\ny')).toThrow('Input contains invalid control characters');
    });

    it('throws on other control chars', () => {
      expect(() => rejectControlChars('\x01')).toThrow();
      expect(() => rejectControlChars('a\x1fb')).toThrow();
    });

    it('allows space (0x20)', () => {
      expect(rejectControlChars('a b')).toBe('a b');
    });
  });

  describe('validateResourceId', () => {
    it('accepts valid UUID', () => {
      expect(validateResourceId('550e8400-e29b-41d4-a716-446655440000')).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('accepts safe slug', () => {
      expect(validateResourceId('my-chart-slug')).toBe('my-chart-slug');
      expect(validateResourceId('chart_123')).toBe('chart_123');
    });

    it('throws on ? in ID', () => {
      expect(() => validateResourceId('uuid?fields=name')).toThrow('Resource ID must not contain');
    });

    it('throws on # in ID', () => {
      expect(() => validateResourceId('uuid#fragment')).toThrow('Resource ID must not contain');
    });

    it('throws on % in ID', () => {
      expect(() => validateResourceId('uuid%2e')).toThrow('Resource ID must not contain');
    });

    it('throws on path traversal', () => {
      expect(() => validateResourceId('../etc/passwd')).toThrow('Resource ID must not contain');
      expect(() => validateResourceId('uuid/../other')).toThrow('Resource ID must not contain');
    });

    it('throws on control chars', () => {
      expect(() => validateResourceId('x\u0000y')).toThrow(
        'Input contains invalid control characters',
      );
    });

    it('throws when id is not a string', () => {
      expect(() => validateResourceId(123 as unknown as string)).toThrow(
        'Resource ID must be a string',
      );
    });
  });

  describe('validateUuid', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    it('accepts lowercase UUID', () => {
      expect(validateUuid(validUuid)).toBe(validUuid);
    });

    it('accepts uppercase UUID', () => {
      expect(validateUuid(validUuid.toUpperCase())).toBe(validUuid.toUpperCase());
    });

    it('throws on invalid format', () => {
      expect(() => validateUuid('not-a-uuid')).toThrow('Invalid UUID format');
      expect(() => validateUuid('550e8400-e29b-41d4-a716')).toThrow('Invalid UUID format');
      expect(() => validateUuid('550e8400-e29b-41d4-a716-446655440000-extra')).toThrow(
        'Invalid UUID format',
      );
    });

    it('throws on control characters', () => {
      expect(() => validateUuid('550e8400-e29b-41d4-a716\u000044655440000')).toThrow(
        'Input contains invalid control characters',
      );
    });

    it('throws when id is not a string', () => {
      expect(() => validateUuid(123 as unknown as string)).toThrow('UUID must be a string');
    });
  });

  describe('validateSlug', () => {
    it('accepts valid slugs', () => {
      expect(validateSlug('my-chart')).toBe('my-chart');
      expect(validateSlug('chart_123')).toBe('chart_123');
      expect(validateSlug('a.b-c_d')).toBe('a.b-c_d');
    });

    it('throws on empty slug', () => {
      expect(() => validateSlug('')).toThrow('Slug must be between 1 and 256 characters');
    });

    it('throws when slug exceeds max length', () => {
      expect(() => validateSlug('a'.repeat(257))).toThrow(
        'Slug must be between 1 and 256 characters',
      );
    });

    it('accepts slug at max length', () => {
      const slug = 'a'.repeat(256);
      expect(validateSlug(slug)).toBe(slug);
    });

    it('throws on invalid characters', () => {
      expect(() => validateSlug('has space')).toThrow(
        'Slug must contain only alphanumeric characters, dots, underscores, and hyphens',
      );
      expect(() => validateSlug('slug?query')).toThrow(
        'Slug must contain only alphanumeric characters, dots, underscores, and hyphens',
      );
    });

    it('throws on control characters', () => {
      expect(() => validateSlug('slug\u0001')).toThrow('Input contains invalid control characters');
    });

    it('throws when id is not a string', () => {
      expect(() => validateSlug(123 as unknown as string)).toThrow('Slug must be a string');
    });
  });

  describe('validateFingerprint', () => {
    it('accepts non-empty fingerprints', () => {
      expect(validateFingerprint('abc123')).toBe('abc123');
      expect(validateFingerprint('sha256:deadbeef')).toBe('sha256:deadbeef');
    });

    it('throws on empty fingerprint', () => {
      expect(() => validateFingerprint('')).toThrow(
        'Fingerprint must be between 1 and 512 characters',
      );
    });

    it('throws when fingerprint exceeds max length', () => {
      expect(() => validateFingerprint('x'.repeat(513))).toThrow(
        'Fingerprint must be between 1 and 512 characters',
      );
    });

    it('accepts fingerprint at max length', () => {
      const fp = 'x'.repeat(512);
      expect(validateFingerprint(fp)).toBe(fp);
    });

    it('throws on control characters', () => {
      expect(() => validateFingerprint('fp\u0000')).toThrow(
        'Input contains invalid control characters',
      );
    });

    it('throws when id is not a string', () => {
      expect(() => validateFingerprint(123 as unknown as string)).toThrow(
        'Fingerprint must be a string',
      );
    });
  });

  describe('validateSafeOutputDir', () => {
    it('accepts path within CWD', () => {
      const result = validateSafeOutputDir('output');
      expect(result).toContain(process.cwd());
    });

    it('accepts relative subdir', async () => {
      const pathModule = await import('node:path');
      const result = validateSafeOutputDir('foo/bar');
      expect(result).toBe(pathModule.resolve(process.cwd(), 'foo/bar'));
    });

    it('throws on .. traversal', () => {
      expect(() => validateSafeOutputDir('../other')).toThrow(
        'Path must be within current working directory',
      );
    });

    it('throws on .. traversal escaping CWD', () => {
      expect(() => validateSafeOutputDir('../../etc')).toThrow(
        'Path must be within current working directory',
      );
    });

    it('accepts CWD itself', () => {
      const result = validateSafeOutputDir('.');
      expect(result).toBe(process.cwd());
    });
  });
});
