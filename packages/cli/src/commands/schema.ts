/**
 * Schema introspection command for agent discoverability.
 * Outputs machine-readable JSON describing API paths, methods, and parameters.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { wrapAction } from '../utils/safety';

/** Maps resource identifiers to API path + method + description. */
const SCHEMA_REGISTRY: Record<
  string,
  { path: string; method: string; description: string; params?: string[] }
> = {
  'organization.get': {
    path: '/api/v1/org',
    method: 'GET',
    description: 'Get current organization details',
  },
  'projects.list': {
    path: '/api/v1/org/projects',
    method: 'GET',
    description: 'List all projects in the organization',
  },
  'projects.get': {
    path: '/api/v1/projects/{projectUuid}',
    method: 'GET',
    description: 'Get project by UUID',
    params: ['projectUuid'],
  },
  'charts.list': {
    path: '/api/v1/projects/{projectUuid}/charts',
    method: 'GET',
    description: 'List charts in a project',
    params: ['projectUuid'],
  },
  'charts.code.list': {
    path: '/api/v1/projects/{projectUuid}/charts/code',
    method: 'GET',
    description: 'Get charts in code representation',
    params: ['projectUuid'],
  },
  'charts.code.upsert': {
    path: '/api/v1/projects/{projectUuid}/charts/{slug}/code',
    method: 'POST',
    description: 'Create or update chart by slug',
    params: ['projectUuid', 'slug'],
  },
  'dashboards.list': {
    path: '/api/v1/projects/{projectUuid}/dashboards',
    method: 'GET',
    description: 'List dashboards in a project',
    params: ['projectUuid'],
  },
  'spaces.list': {
    path: '/api/v1/projects/{projectUuid}/spaces',
    method: 'GET',
    description: 'List spaces in a project',
    params: ['projectUuid'],
  },
  'ai-agents.list': {
    path: '/api/v1/aiAgents/admin/agents',
    method: 'GET',
    description: 'List AI agents (admin)',
  },
  'ai-agents.threads': {
    path: '/api/v1/aiAgents/admin/threads',
    method: 'GET',
    description: 'List AI agent threads (admin)',
  },
  'ai-agents.settings.get': {
    path: '/api/v1/aiAgents/admin/settings',
    method: 'GET',
    description: 'Get AI organization settings',
  },
  'ai-agents.settings.update': {
    path: '/api/v1/aiAgents/admin/settings',
    method: 'PATCH',
    description: 'Update AI organization settings',
  },
  'projects.validate.run': {
    path: '/api/v1/projects/{projectUuid}/validate',
    method: 'POST',
    description: 'Start project validation job',
    params: ['projectUuid'],
  },
  'projects.validate.results': {
    path: '/api/v1/projects/{projectUuid}/validate',
    method: 'GET',
    description: 'Get latest validation results',
    params: ['projectUuid'],
  },
};

export function getSchema(resource: string): Record<string, unknown> | null {
  const entry = SCHEMA_REGISTRY[resource];
  if (!entry) return null;
  return {
    resource,
    path: entry.path,
    method: entry.method,
    description: entry.description,
    params: entry.params ?? [],
  };
}

export function listResources(): string[] {
  return Object.keys(SCHEMA_REGISTRY).sort();
}

/**
 * Registers the schema introspection command.
 */
export function registerSchemaCommand(program: Command): void {
  const schemaCmd = program
    .command('schema')
    .description('Introspect API schema for agent discoverability');

  schemaCmd
    .command('list')
    .description('List all introspectable resources')
    .action(
      wrapAction(READ_ONLY_DEFAULT, () => {
        const resources = listResources();
        console.log(JSON.stringify({ resources }, null, 2));
      }),
    );

  schemaCmd
    .command('get <resource>')
    .description('Get schema for a resource (e.g. charts.list, ai-agents.settings.get)')
    .action(
      wrapAction(READ_ONLY_DEFAULT, (resource: string) => {
        const schema = getSchema(resource);
        if (!schema) {
          const available = listResources().join(', ');
          console.error(`Error: Unknown resource '${resource}'. Available: ${available}`);
          process.exit(1);
        }
        console.log(JSON.stringify(schema, null, 2));
      }),
    );
}
