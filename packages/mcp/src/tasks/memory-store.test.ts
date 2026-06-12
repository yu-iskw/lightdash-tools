import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ENV_LIGHTDASH_TOOLS_MCP_TASKS, MemoryTaskStore } from './memory-store.js';

describe('MemoryTaskStore', () => {
  const originalValue = process.env[ENV_LIGHTDASH_TOOLS_MCP_TASKS];

  beforeEach(() => {
    process.env[ENV_LIGHTDASH_TOOLS_MCP_TASKS] = 'experimental';
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_LIGHTDASH_TOOLS_MCP_TASKS];
    } else {
      process.env[ENV_LIGHTDASH_TOOLS_MCP_TASKS] = originalValue;
    }
  });

  it('is disabled unless LIGHTDASH_TOOLS_MCP_TASKS=experimental', () => {
    const store = new MemoryTaskStore();
    expect(store.isEnabled()).toBe(true);

    delete process.env[ENV_LIGHTDASH_TOOLS_MCP_TASKS];
    expect(store.create()).toBeUndefined();
    expect(store.list()).toEqual([]);
  });

  it('creates, updates, and deletes tasks in memory', () => {
    const store = new MemoryTaskStore();
    const created = store.create({ operationId: 'ai-agents.project.evaluations.run' });
    expect(created?.status).toBe('pending');

    const updated = store.updateStatus(created!.id, 'completed', { result: { ok: true } });
    expect(updated?.status).toBe('completed');
    expect(updated?.result).toEqual({ ok: true });

    expect(store.get(created!.id)?.status).toBe('completed');
    expect(store.list()).toHaveLength(1);

    expect(store.delete(created!.id)).toBe(true);
    expect(store.list()).toHaveLength(0);
  });
});
