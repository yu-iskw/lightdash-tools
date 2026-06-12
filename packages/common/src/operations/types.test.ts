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
  profiles: ['discovery-readonly' as const],
};

describe('defineOperation', () => {
  it('accepts a valid read descriptor', () => {
    expect(defineOperation(baseDescriptor)).toEqual(baseDescriptor);
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
