import { describe, it, expect } from 'vitest';
import { rejectControlChars, validateResourceId, validateSafeOutputDir } from './input-validation';

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
