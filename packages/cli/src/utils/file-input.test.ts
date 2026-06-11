import { readFileSync } from 'node:fs';

import { describe, expect, it, vi, afterEach } from 'vitest';

import {
  hasExplicitFileInput,
  parseJsonOrYaml,
  readFileOrStdin,
  readParsedInput,
} from './file-input';

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
}));

describe('file-input', () => {
  afterEach(() => {
    vi.mocked(readFileSync).mockReset();
  });

  describe('parseJsonOrYaml', () => {
    it('parses JSON objects', () => {
      expect(parseJsonOrYaml('{"name":"agent"}')).toEqual({ name: 'agent' });
    });

    it('parses JSON arrays', () => {
      expect(parseJsonOrYaml('[1,2]')).toEqual([1, 2]);
    });

    it('parses YAML objects', () => {
      expect(parseJsonOrYaml('name: agent\ntags:\n  - a')).toEqual({
        name: 'agent',
        tags: ['a'],
      });
    });

    it('rejects empty input', () => {
      expect(() => parseJsonOrYaml('   ')).toThrow('Input is empty');
    });

    it('rejects invalid JSON', () => {
      expect(() => parseJsonOrYaml('{not json')).toThrow();
    });
  });

  describe('hasExplicitFileInput', () => {
    it('returns true only for --file or --stdin', () => {
      expect(hasExplicitFileInput({ file: 'agent.json' })).toBe(true);
      expect(hasExplicitFileInput({ stdin: true })).toBe(true);
      expect(hasExplicitFileInput({})).toBe(false);
      expect(hasExplicitFileInput({ stdin: false })).toBe(false);
    });
  });

  describe('readFileOrStdin', () => {
    it('reads from file path', async () => {
      vi.mocked(readFileSync).mockReturnValue('{"x":1}');
      const result = await readFileOrStdin({ file: 'agent.json' });
      expect(result).toBe('{"x":1}');
      expect(readFileSync).toHaveBeenCalledWith('agent.json', 'utf-8');
    });
  });

  describe('readParsedInput', () => {
    it('reads and parses file content', async () => {
      vi.mocked(readFileSync).mockReturnValue('name: test');
      await expect(readParsedInput({ file: 'agent.yaml' })).resolves.toEqual({ name: 'test' });
    });

    it('wraps parse errors with context', async () => {
      vi.mocked(readFileSync).mockReturnValue('{bad');
      await expect(readParsedInput({ file: 'bad.json' })).rejects.toThrow(
        'Failed to parse input as JSON or YAML',
      );
    });
  });
});
