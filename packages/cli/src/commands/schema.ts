/**
 * Shared CLI schema command — catalog-only introspection (ADR-0013).
 */

import { getOperation, listOperations, READ_ONLY_DEFAULT } from '@lightdash-tools/common';

import { wrapAction } from '../utils/safety';

import type { OperationDescriptor } from '@lightdash-tools/common';
import type { Command } from 'commander';

function extractPathParams(path: string): string[] {
  const params: string[] = [];
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    params.push(match[1]);
  }
  return params;
}

function operationToSchema(operation: OperationDescriptor): Record<string, unknown> {
  return {
    resource: operation.id,
    path: operation.http.path,
    method: operation.http.method,
    description: operation.summary,
    params: extractPathParams(operation.http.path),
    ...(operation.cli != null ? { cliCommand: operation.cli.commandPath } : {}),
    ...(operation.mcp?.taskSupport.exposed === true ? { mcpToolName: operation.mcp.toolName } : {}),
    ...(operation.bannedMcpToolName != null
      ? { bannedMcpToolName: operation.bannedMcpToolName }
      : {}),
    agentExposure: operation.agentExposure,
    sensitivity: operation.sensitivity,
    profiles: [...operation.profiles],
    safetyImpact: operation.authorization.safetyImpact,
    ...(operation.workflow != null ? { workflow: [...operation.workflow] } : {}),
  };
}

export function getSchema(resource: string): Record<string, unknown> | null {
  const operation = getOperation(resource);
  if (operation) {
    return operationToSchema(operation);
  }
  return null;
}

export function listResources(): string[] {
  return listOperations()
    .map((operation) => operation.id)
    .sort();
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
    .description('List all introspectable resources from the operation catalog')
    .action(
      wrapAction(READ_ONLY_DEFAULT, () => {
        const resources = listResources();
        console.log(JSON.stringify({ resources }, null, 2));
      }),
    );

  schemaCmd
    .command('get <resource>')
    .description('Get schema for a catalog operation id (e.g. ai-agents.project.agents.list)')
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
