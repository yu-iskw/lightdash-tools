import { describe, expect, it } from 'vitest';

import { AI_AGENT_OPERATIONS } from './ai-agents';
import { CLI_CONTENT_OPERATIONS } from './cli-content';
import { CONTENT_DEVELOPER_OPERATIONS } from './content-developer';
import { CONTENT_GOVERNANCE_OPERATIONS } from './content-governance';
import { CONTENT_READER_OPERATIONS } from './content-reader';
import { ORGANIZATION_AUDIT_OPERATIONS } from './organization-audit';
import { getOperation, getOperationsByProfile, listOperations } from './registry';
import { SEMANTIC_LAYER_OPERATIONS } from './semantic-layer';
import { defineOperation } from './types';
import { USER_OPERATIONS } from './users';

import type { CapabilityProfile, OperationDescriptor } from './types';

const P0_OPERATION_IDS = [
  'ai-agents.admin.agents.list',
  'ai-agents.admin.settings.get',
  'ai-agents.admin.settings.update',
  'ai-agents.project.agents.list',
  'ai-agents.project.agents.get',
  'ai-agents.project.agents.create',
  'ai-agents.project.agents.update',
  'ai-agents.project.agents.delete',
  'ai-agents.project.threads.start',
  'ai-agents.project.threads.continue',
  'ai-agents.project.evaluations.list',
  'ai-agents.project.evaluations.get',
  'ai-agents.project.evaluations.create',
  'ai-agents.project.evaluations.update',
  'ai-agents.project.evaluations.append',
  'ai-agents.project.evaluations.delete',
  'ai-agents.project.evaluations.run',
  'ai-agents.project.evaluations.runs.list',
] as const;

const ALL_PROFILES: CapabilityProfile[] = [
  'ai-agent-ops',
  'core-lifecycle',
  'evaluations',
  'conversations',
  'discovery-readonly',
];

function requiredFields(operation: OperationDescriptor): string[] {
  const agentExposure = operation.agentExposure ?? 'agent';
  const fields = [
    operation.id,
    operation.summary,
    operation.http.method,
    operation.http.path,
    operation.authorization.safetyImpact,
    operation.sensitivity,
    agentExposure,
  ];
  if (agentExposure === 'agent') {
    if (operation.mcp !== undefined) {
      fields.push(operation.mcp.toolName);
    }
    if (operation.cli !== undefined) {
      fields.push(operation.cli.commandPath);
    }
  }
  return fields;
}

describe('operation registry', () => {
  it('registers all P0 operation ids', () => {
    for (const id of P0_OPERATION_IDS) {
      expect(getOperation(id)).toBeDefined();
    }
  });

  it('has no duplicate operation ids', () => {
    const ids = listOperations().map((operation) => operation.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches aggregated domain export count', () => {
    expect(listOperations()).toHaveLength(
      AI_AGENT_OPERATIONS.length +
        USER_OPERATIONS.length +
        SEMANTIC_LAYER_OPERATIONS.length +
        ORGANIZATION_AUDIT_OPERATIONS.length +
        CONTENT_READER_OPERATIONS.length +
        CONTENT_DEVELOPER_OPERATIONS.length +
        CONTENT_GOVERNANCE_OPERATIONS.length +
        CLI_CONTENT_OPERATIONS.length,
    );
  });

  it('includes required descriptor fields on every operation', () => {
    for (const operation of listOperations()) {
      for (const field of requiredFields(operation)) {
        expect(field).toBeTruthy();
      }
      if (operation.agentExposure === 'agent') {
        expect(operation.mcp !== undefined || operation.cli !== undefined).toBe(true);
      }
      expect(operation.profiles.length).toBeGreaterThan(0);
      expect(
        operation.http.path.startsWith('/api/v1/') || operation.http.path.startsWith('/api/v2/'),
      ).toBe(true);
    }
  });

  it('assigns idempotentHint correctly for read and destructive agent operations', () => {
    for (const operation of listOperations()) {
      if (operation.mcp === undefined) {
        continue;
      }
      const { annotations } = operation.mcp;
      if (operation.authorization.safetyImpact === 'read') {
        expect(annotations.readOnlyHint).toBe(true);
      }
      if (operation.authorization.safetyImpact === 'write-destructive') {
        expect(annotations.destructiveHint).toBe(true);
        expect(annotations.idempotentHint).toBe(false);
      }
    }
  });

  it('exposes profile filters for all capability profiles', () => {
    for (const profile of ALL_PROFILES) {
      const operations = getOperationsByProfile(profile);
      expect(operations.length).toBeGreaterThan(0);
      for (const operation of operations) {
        expect(operation.profiles).toContain(profile);
      }
    }
  });

  it('maps agent CRUD to core-lifecycle profile', () => {
    const crudIds = [
      'ai-agents.project.agents.list',
      'ai-agents.project.agents.get',
      'ai-agents.project.agents.create',
      'ai-agents.project.agents.update',
      'ai-agents.project.agents.delete',
    ];
    for (const id of crudIds) {
      const operation = getOperation(id);
      expect(operation?.profiles).toContain('core-lifecycle');
    }
  });

  it('maps thread start and continue to conversations profile', () => {
    expect(getOperation('ai-agents.project.threads.start')?.profiles).toContain('conversations');
    expect(getOperation('ai-agents.project.threads.continue')?.profiles).toContain('conversations');
  });

  it('documents multi-step workflow for thread start', () => {
    const operation = getOperation('ai-agents.project.threads.start');
    expect(operation?.http.path).toBe(
      '/api/v1/projects/{projectUuid}/aiAgents/{agentUuid}/threads',
    );
    expect(operation?.cli?.commandPath).toBe('agents threads start');
    expect(operation?.workflow).toHaveLength(3);
    const lastStep = operation?.workflow?.[operation.workflow.length - 1];
    expect(lastStep?.path).toContain('/generate');
  });

  it('documents multi-step workflow for thread continue', () => {
    const operation = getOperation('ai-agents.project.threads.continue');
    expect(operation?.workflow).toHaveLength(2);
    expect(operation?.workflow?.[0]?.path).toContain('/messages');
    expect(operation?.workflow?.[1]?.path).toContain('/generate');
  });

  it('maps evaluation lifecycle operations to evaluations profile', () => {
    const evalIds = [
      'ai-agents.project.evaluations.create',
      'ai-agents.project.evaluations.append',
      'ai-agents.project.evaluations.run',
      'ai-agents.project.evaluations.runs.list',
    ];
    for (const id of evalIds) {
      expect(getOperation(id)?.profiles).toContain('evaluations');
    }
  });

  it('returns undefined for unknown operation id', () => {
    expect(getOperation('ai-agents.unknown.operation')).toBeUndefined();
  });

  it('filters operations by profile with empty result for unknown profile usage', () => {
    const ops = getOperationsByProfile('core-lifecycle');
    expect(ops.every((op) => op.profiles.includes('core-lifecycle'))).toBe(true);
  });

  it('registers users.members.delete as client-only', () => {
    const operation = getOperation('users.members.delete');
    expect(operation?.agentExposure).toBe('client-only');
    expect(operation?.mcp).toBeUndefined();
    expect(operation?.cli).toBeUndefined();
    expect(operation?.bannedMcpToolName).toBe('delete_member');
    expect(operation?.http.path).toBe('/api/v1/org/user/{userUuid}');
  });

  it('excludes client-only operations from profile discovery catalogs', () => {
    for (const profile of ALL_PROFILES) {
      for (const operation of getOperationsByProfile(profile)) {
        expect(operation.agentExposure).not.toBe('client-only');
      }
    }
    expect(getOperation('users.members.delete')).toBeDefined();
    expect(
      getOperationsByProfile('discovery-readonly').some((op) => op.id === 'users.members.delete'),
    ).toBe(false);
  });

  it('keeps discovery-readonly profile operations read-only', () => {
    for (const operation of getOperationsByProfile('discovery-readonly')) {
      expect(operation.authorization.safetyImpact).toBe('read');
    }
  });

  it('never exposes client-only operations on MCP', () => {
    for (const operation of listOperations()) {
      if (operation.agentExposure === 'client-only') {
        expect(operation.mcp).toBeUndefined();
        expect(operation.cli).toBeUndefined();
      }
    }
  });

  it('rejects descriptors whose safetyImpact disagrees with MCP annotations', () => {
    expect(() =>
      defineOperation({
        id: 'test.invalid-impact',
        summary: 'Invalid impact pairing',
        http: { method: 'GET', path: '/api/v1/test' },
        authorization: { safetyImpact: 'write-destructive' },
        sensitivity: 'none',
        mcp: {
          toolName: 'test_tool',
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          taskSupport: { exposed: true, taskEligible: false },
        },
        cli: { commandPath: 'test' },
        agentExposure: 'agent',
        profiles: ['discovery-readonly'],
      }),
    ).toThrow(/authorization\.safetyImpact/);
  });
});
