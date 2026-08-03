import { describe, it, expect } from 'vitest';

import { getSchema, listResources } from './schema';

describe('schema command', () => {
  describe('getSchema', () => {
    it('returns schema for ai-agents.project.agents.list from the operation catalog', () => {
      const schema = getSchema('ai-agents.project.agents.list');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/projects/{projectUuid}/aiAgents');
      expect(schema).toHaveProperty('method', 'GET');
      expect(schema).toHaveProperty('cliCommand', 'agents list');
      expect(schema).toHaveProperty('mcpToolName', 'list_project_agents');
      expect(schema).toHaveProperty('profiles');
      expect(schema?.profiles).toContain('core-lifecycle');
      expect(schema?.profiles).toContain('ai-agent-ops');
      expect(schema).toHaveProperty('sensitivity', 'none');
    });

    it('returns schema for ai-agents.admin.settings.update from the operation catalog', () => {
      const schema = getSchema('ai-agents.admin.settings.update');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/aiAgents/admin/settings');
      expect(schema).toHaveProperty('method', 'PATCH');
      expect(schema).toHaveProperty('cliCommand', 'ai-agents settings update');
      expect(schema).not.toHaveProperty('mcpToolName');
    });

    it('returns schema for cli.charts.list from the operation catalog', () => {
      const schema = getSchema('cli.charts.list');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('path', '/api/v1/projects/{projectUuid}/code/charts');
      expect(schema).toHaveProperty('method', 'GET');
      expect(schema?.params).toEqual(['projectUuid']);
      expect(schema).toHaveProperty('cliCommand', 'projects charts list');
    });

    it('returns schema for semantic.projects.list with exposed MCP tool name', () => {
      const schema = getSchema('semantic.projects.list');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('mcpToolName', 'list_projects');
      expect(schema).toHaveProperty('cliCommand', 'projects list');
    });

    it('returns schema for ai-agents.project.evaluations.create from the operation catalog', () => {
      const schema = getSchema('ai-agents.project.evaluations.create');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('method', 'POST');
      expect(schema).toHaveProperty('cliCommand', 'agents evals create');
      expect(schema?.params).toEqual(expect.arrayContaining(['projectUuid', 'agentUuid']));
    });

    it('returns schema for ai-agents.project.threads.start from the operation catalog', () => {
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

    it('returns workflow for ai-agents.project.threads.continue from the operation catalog', () => {
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

    it('returns schema for users.members.delete with client-only exposure', () => {
      const schema = getSchema('users.members.delete');
      expect(schema).not.toBeNull();
      expect(schema).toHaveProperty('method', 'DELETE');
      expect(schema).toHaveProperty('path', '/api/v1/org/user/{userUuid}');
      expect(schema).toHaveProperty('agentExposure', 'client-only');
      expect(schema).toHaveProperty('bannedMcpToolName', 'delete_member');
    });

    it('returns null for unknown resource', () => {
      const schema = getSchema('unknown.resource');
      expect(schema).toBeNull();
    });

    it('does not resolve retired legacy schema keys', () => {
      expect(getSchema('charts.list')).toBeNull();
      expect(getSchema('ai-agents.settings.update')).toBeNull();
    });
  });

  describe('listResources', () => {
    it('returns sorted catalog operation ids only', () => {
      const resources = listResources();
      expect(resources).toEqual([...resources].sort());
      expect(resources).not.toContain('charts.list');
      expect(resources).toContain('cli.charts.list');
      expect(resources).toContain('ai-agents.project.agents.list');
      expect(resources).toContain('ai-agents.project.evaluations.run');
      expect(resources).toContain('ai-agents.project.threads.continue');
      expect(resources).toContain('semantic.projects.list');
    });
  });
});
