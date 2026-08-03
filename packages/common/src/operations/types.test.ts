import { describe, expect, it } from 'vitest';

import { defineOperation } from './types';

const baseDescriptor = {
  id: 'test.operation',
  summary: 'Test operation',
  http: { method: 'GET' as const, path: '/api/v1/test' },
  authorization: { safetyImpact: 'read' as const },
  sensitivity: 'none' as const,
  mcp: {
    toolName: 'test_op',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    taskSupport: { exposed: true, taskEligible: false },
  },
  cli: { commandPath: 'test op' },
  agentExposure: 'agent' as const,
  profiles: ['semantic-layer' as const],
};

describe('defineOperation', () => {
  it('accepts a valid read descriptor', () => {
    expect(defineOperation(baseDescriptor)).toEqual({
      ...baseDescriptor,
      agentExposure: 'agent',
      sensitivity: 'none',
    });
  });

  it('defaults agentExposure to agent and sensitivity to none', () => {
    const { agentExposure, sensitivity, ...withoutDefaults } = baseDescriptor;
    void agentExposure;
    void sensitivity;
    const op = defineOperation(withoutDefaults);
    expect(op.agentExposure).toBe('agent');
    expect(op.sensitivity).toBe('none');
  });

  it('allows agent ops with mcp only', () => {
    const { cli: _cli, ...rest } = baseDescriptor;
    void _cli;
    expect(defineOperation(rest).cli).toBeUndefined();
  });

  it('allows agent ops with cli only', () => {
    const { mcp: _mcp, ...rest } = baseDescriptor;
    void _mcp;
    expect(defineOperation({ ...rest, profiles: [] }).mcp).toBeUndefined();
  });

  it('rejects agent ops with neither mcp nor cli', () => {
    const { mcp: _mcp, cli: _cli, ...rest } = baseDescriptor;
    void _mcp;
    void _cli;
    expect(() => defineOperation({ ...rest, profiles: [] })).toThrow(/require mcp and\/or cli/);
  });

  it('rejects empty id', () => {
    expect(() => defineOperation({ ...baseDescriptor, id: '  ' })).toThrow(/id/);
  });

  it('rejects unknown profile', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        profiles: ['unknown-profile' as 'semantic-layer'],
      }),
    ).toThrow(/unknown profile/);
  });

  it('rejects empty profiles when MCP-exposed', () => {
    expect(() => defineOperation({ ...baseDescriptor, profiles: [] })).toThrow(
      /at least one profile/,
    );
  });

  it('rejects duplicate profiles', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        profiles: ['semantic-layer', 'semantic-layer'],
      }),
    ).toThrow(/duplicate profiles/);
  });

  it('rejects non-empty profiles when not MCP-exposed', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        mcp: {
          ...baseDescriptor.mcp,
          taskSupport: { exposed: false, taskEligible: false },
        },
        profiles: ['semantic-layer'],
      }),
    ).toThrow(/empty profiles/);
  });

  it('allows read operation with idempotentHint false (transient execution)', () => {
    const op = defineOperation({
      ...baseDescriptor,
      mcp: {
        ...baseDescriptor.mcp,
        annotations: { ...baseDescriptor.mcp.annotations, idempotentHint: false },
      },
    });
    expect(op.mcp?.annotations.idempotentHint).toBe(false);
  });

  it('rejects client-only operation that still has mcp', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        agentExposure: 'client-only',
      }),
    ).toThrow(/must omit mcp and cli/);
  });

  it('allows client-only operation with bannedMcpToolName and no mcp/cli', () => {
    const op = defineOperation({
      id: 'test.client-only',
      summary: 'Client only delete',
      http: { method: 'DELETE', path: '/api/v1/test/{id}' },
      authorization: { safetyImpact: 'write-destructive' },
      agentExposure: 'client-only',
      bannedMcpToolName: 'delete_test',
      profiles: [],
    });
    expect(op.agentExposure).toBe('client-only');
    expect(op.bannedMcpToolName).toBe('delete_test');
    expect(op.sensitivity).toBe('none');
  });
});
