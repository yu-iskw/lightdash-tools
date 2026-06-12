import { describe, expect, it } from 'vitest';

import { defineOperation } from './types';

const baseDescriptor = {
  id: 'test.operation',
  summary: 'Test operation',
  http: { method: 'GET' as const, path: '/api/v1/test' },
  authorization: { safetyImpact: 'read' as const },
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
  profiles: ['discovery-readonly' as const],
};

describe('defineOperation', () => {
  it('accepts a valid read descriptor', () => {
    expect(defineOperation(baseDescriptor)).toEqual({
      ...baseDescriptor,
      agentExposure: 'agent',
    });
  });

  it('defaults agentExposure to agent', () => {
    const { agentExposure, ...withoutExposure } = baseDescriptor;
    void agentExposure;
    expect(defineOperation(withoutExposure).agentExposure).toBe('agent');
  });

  it('rejects empty id', () => {
    expect(() => defineOperation({ ...baseDescriptor, id: '  ' })).toThrow(/id/);
  });

  it('rejects empty summary', () => {
    expect(() => defineOperation({ ...baseDescriptor, summary: '' })).toThrow(/summary/);
  });

  it('rejects empty http path', () => {
    expect(() => defineOperation({ ...baseDescriptor, http: { method: 'GET', path: '' } })).toThrow(
      /http.path/,
    );
  });

  it('rejects empty profiles', () => {
    expect(() => defineOperation({ ...baseDescriptor, profiles: [] })).toThrow(/profile/);
  });

  it('rejects unknown profile', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        profiles: ['unknown-profile' as 'discovery-readonly'],
      }),
    ).toThrow(/unknown capability profile/);
  });

  it('rejects read operation without idempotentHint', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        mcp: {
          ...baseDescriptor.mcp,
          annotations: { ...baseDescriptor.mcp.annotations, idempotentHint: false },
        },
      }),
    ).toThrow(/idempotentHint/);
  });

  it('rejects destructive operation with idempotentHint true', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        authorization: { safetyImpact: 'write-destructive' },
        mcp: {
          ...baseDescriptor.mcp,
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
      }),
    ).toThrow(/destructive operations/);
  });

  it('rejects client-only operation with mcp exposed', () => {
    expect(() =>
      defineOperation({
        ...baseDescriptor,
        agentExposure: 'client-only',
        mcp: {
          ...baseDescriptor.mcp,
          taskSupport: { exposed: true, taskEligible: false },
        },
      }),
    ).toThrow(/client-only operations must set mcp.taskSupport.exposed to false/);
  });

  it('allows client-only operation without mcp tool name or cli path', () => {
    const op = defineOperation({
      id: 'test.client-only',
      summary: 'Client only delete',
      http: { method: 'DELETE', path: '/api/v1/test/{id}' },
      authorization: { safetyImpact: 'write-destructive' },
      mcp: {
        toolName: '',
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
        taskSupport: { exposed: false, taskEligible: false },
      },
      cli: { commandPath: '' },
      agentExposure: 'client-only',
      profiles: ['discovery-readonly'],
    });
    expect(op.agentExposure).toBe('client-only');
  });

  it('maps openWorldHint to external-side-effect impact', () => {
    const op = defineOperation({
      ...baseDescriptor,
      authorization: { safetyImpact: 'external-side-effect' },
      mcp: {
        ...baseDescriptor.mcp,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
    });
    expect(op.authorization.safetyImpact).toBe('external-side-effect');
  });
});
