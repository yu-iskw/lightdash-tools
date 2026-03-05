import { describe, it, expect } from 'vitest';
import { getSchema, listResources } from './schema';

describe('schema command', () => {
  describe('getSchema', () => {
    it('returns JSON with path, method, params for charts.list', () => {
      const schema = getSchema('charts.list');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/projects/{projectUuid}/charts');
      expect(schema).toHaveProperty('method', 'GET');
      expect(schema).toHaveProperty('params');
      expect(schema?.params).toEqual(['projectUuid']);
      expect(schema).toHaveProperty('description');
      expect(schema).toHaveProperty('resource', 'charts.list');
    });

    it('returns schema for ai-agents.settings.update', () => {
      const schema = getSchema('ai-agents.settings.update');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/aiAgents/admin/settings');
      expect(schema).toHaveProperty('method', 'PATCH');
    });

    it('returns null for unknown resource', () => {
      const schema = getSchema('unknown.resource');
      expect(schema).toBeNull();
    });
  });

  describe('listResources', () => {
    it('returns sorted list of resource identifiers', () => {
      const resources = listResources();
      expect(resources).toContain('charts.list');
      expect(resources).toContain('ai-agents.settings.get');
      expect(resources).toEqual([...resources].sort());
    });

    it('includes charts.list', () => {
      expect(listResources()).toContain('charts.list');
    });
  });
});
