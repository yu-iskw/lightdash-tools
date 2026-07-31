import { AsyncLocalStorage } from 'node:async_hooks';

export type ToolAuditAuthContext = {
  tokenHash?: string;
  subject?: string;
};

const storage = new AsyncLocalStorage<ToolAuditAuthContext>();

export async function runWithToolAuditAuthAsync<T>(
  auth: ToolAuditAuthContext,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(auth, fn);
}

export function getToolAuditAuth(): ToolAuditAuthContext | undefined {
  return storage.getStore();
}
