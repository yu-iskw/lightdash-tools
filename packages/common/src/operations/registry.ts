/**
 * Central operation registry — aggregates domain modules and exposes lookup helpers.
 */

import { AI_AGENT_OPERATIONS } from './ai-agents';
import { USER_OPERATIONS } from './users';

import type { CapabilityProfile, OperationDescriptor } from './types';

const ALL_OPERATIONS: readonly OperationDescriptor[] = [...AI_AGENT_OPERATIONS, ...USER_OPERATIONS];

const operationsById = new Map<string, OperationDescriptor>(
  ALL_OPERATIONS.map((operation) => [operation.id, operation]),
);

if (operationsById.size !== ALL_OPERATIONS.length) {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const operation of ALL_OPERATIONS) {
    if (seen.has(operation.id)) {
      duplicates.push(operation.id);
    }
    seen.add(operation.id);
  }
  throw new Error(`Duplicate operation ids in registry: ${duplicates.join(', ')}`);
}

/** Returns a registered operation by id, or undefined when not found. */
export function getOperation(id: string): OperationDescriptor | undefined {
  return operationsById.get(id);
}

/** Returns every registered operation descriptor. */
export function listOperations(): readonly OperationDescriptor[] {
  return ALL_OPERATIONS;
}

/** Returns operations that include the given capability profile. */
export function getOperationsByProfile(profile: CapabilityProfile): readonly OperationDescriptor[] {
  return ALL_OPERATIONS.filter((operation) => operation.profiles.includes(profile));
}
