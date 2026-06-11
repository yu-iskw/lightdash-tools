/**
 * Experimental in-memory MCP task store (RFC Phase 3 stub).
 *
 * Enabled only when LIGHTDASH_TOOLS_MCP_TASKS=experimental.
 */

import { randomUUID } from 'node:crypto';

export const ENV_LIGHTDASH_TOOLS_MCP_TASKS = 'LIGHTDASH_TOOLS_MCP_TASKS' as const;

export type McpTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type McpTask = {
  id: string;
  status: McpTaskStatus;
  createdAt: string;
  updatedAt: string;
  operationId?: string;
  payload?: unknown;
  result?: unknown;
  error?: string;
};

export type CreateMcpTaskInput = {
  operationId?: string;
  payload?: unknown;
};

/** Returns true when the experimental task store is enabled. */
export function isMcpTasksExperimental(): boolean {
  return process.env[ENV_LIGHTDASH_TOOLS_MCP_TASKS] === 'experimental';
}

/**
 * In-memory task store for async MCP operations (experimental).
 * All mutating methods return undefined when the feature flag is off.
 */
export class MemoryTaskStore {
  private readonly tasks = new Map<string, McpTask>();

  isEnabled(): boolean {
    return isMcpTasksExperimental();
  }

  create(input: CreateMcpTaskInput = {}): McpTask | undefined {
    if (!this.isEnabled()) return undefined;

    const now = new Date().toISOString();
    const task: McpTask = {
      id: randomUUID(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      operationId: input.operationId,
      payload: input.payload,
    };
    this.tasks.set(task.id, task);
    return { ...task };
  }

  get(taskId: string): McpTask | undefined {
    if (!this.isEnabled()) return undefined;
    const task = this.tasks.get(taskId);
    return task ? { ...task } : undefined;
  }

  list(): McpTask[] {
    if (!this.isEnabled()) return [];
    return [...this.tasks.values()].map((task) => ({ ...task }));
  }

  updateStatus(
    taskId: string,
    status: McpTaskStatus,
    patch?: { result?: unknown; error?: string },
  ): McpTask | undefined {
    if (!this.isEnabled()) return undefined;
    const existing = this.tasks.get(taskId);
    if (!existing) return undefined;

    const updated: McpTask = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
      ...(patch?.result !== undefined ? { result: patch.result } : {}),
      ...(patch?.error !== undefined ? { error: patch.error } : {}),
    };
    this.tasks.set(taskId, updated);
    return { ...updated };
  }

  delete(taskId: string): boolean {
    if (!this.isEnabled()) return false;
    return this.tasks.delete(taskId);
  }

  clear(): void {
    this.tasks.clear();
  }
}
