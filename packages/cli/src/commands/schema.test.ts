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

    it('returns schema for ai-agents.settings.update (legacy key)', () => {
      const schema = getSchema('ai-agents.settings.update');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/aiAgents/admin/settings');
      expect(schema).toHaveProperty('method', 'PATCH');
    });

    it('returns schema for ai-agents.project.agents.list from operation registry', () => {
      const schema = getSchema('ai-agents.project.agents.list');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/projects/{projectUuid}/aiAgents');
      expect(schema).toHaveProperty('method', 'GET');
      expect(schema).toHaveProperty('cliCommand', 'agents list');
      expect(schema).toHaveProperty('profiles');
      expect(schema?.profiles).toContain('core-lifecycle');
    });

    it('returns schema for ai-agents.project.evaluations.create from operation registry', () => {
      const schema = getSchema('ai-agents.project.evaluations.create');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('method', 'POST');
      expect(schema).toHaveProperty('cliCommand', 'agents evals create');
      expect(schema?.params).toEqual(expect.arrayContaining(['projectUuid', 'agentUuid']));
    });

    it('returns schema for ai-agents.project.threads.start from operation registry', () => {
      const schema = getSchema('ai-agents.project.threads.start');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('method', 'POST');
      expect(schema).toHaveProperty(
        'path',
        '/api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/threads',
      );
      expect(schema).toHaveProperty('cliCommand', 'agents threads start');
      expect(schema).toHaveProperty('safetyImpact', 'external-side-effect');
      expect(schema?.workflow).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'POST',
            path: '/api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/threads/{threadUuid}/generate',
          }),
        ]),
      );
    });

    it('returns workflow for ai-agents.project.threads.continue from operation registry', () => {
      const schema = getSchema('ai-agents.project.threads.continue');
      expect(schema).not.toBeNull();
      expect(schema?.workflow).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            method: 'POST',
            path: '/api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/threads/{threadUuid}/messages',
          }),
          expect.objectContaining({
            method: 'POST',
            path: '/api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/threads/{threadUuid}/generate',
          }),
        ]),
      );
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

    it('includes project-scoped registry operation ids', () => {
      const resources = listResources();
      expect(resources).toContain('ai-agents.project.agents.list');
      expect(resources).toContain('ai-agents.project.evaluations.run');
      expect(resources).toContain('ai-agents.project.threads.continue');
    });
  });
});
