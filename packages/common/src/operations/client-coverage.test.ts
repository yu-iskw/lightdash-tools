import { describe, expect, it } from 'vitest';

import { OPERATION_CLIENT_METHOD_MAP, getClientMethodForOperation } from './client-coverage';
import { listOperations } from './registry';

describe('operation client coverage', () => {
  it('maps every catalogued operation to a client method or composed ref', () => {
    const missing: string[] = [];
    for (const operation of listOperations()) {
      const method = getClientMethodForOperation(operation.id);
      if (method === undefined || method.trim().length === 0) {
        missing.push(operation.id);
      }
    }
    expect(missing).toEqual([]);
  });

  it('does not leave stale coverage entries for removed operations', () => {
    const catalogIds = new Set(listOperations().map((operation) => operation.id));
    const stale = Object.keys(OPERATION_CLIENT_METHOD_MAP).filter((id) => !catalogIds.has(id));
    expect(stale).toEqual([]);
  });
});
