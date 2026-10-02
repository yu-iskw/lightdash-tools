import { describe, expect, it, vi } from 'vitest';

import { createOperationReporter } from './operation-reporter.js';

import type { ServerContext } from '@modelcontextprotocol/server';

describe('createOperationReporter', () => {
  it('is a no-op when the client did not provide a progress token', async () => {
    const notify = vi.fn();
    const reporter = createOperationReporter({
      mcpReq: { notify },
    } as unknown as ServerContext);

    await reporter.phase({
      phase: 'preparing',
      operation: 'list explores',
      message: 'Preparing to list explores',
    });

    expect(notify).not.toHaveBeenCalled();
  });

  it('is a no-op when notify is missing even if a progress token is present', async () => {
    const reporter = createOperationReporter({
      mcpReq: { _meta: { progressToken: 'progress-1' } },
    } as unknown as ServerContext);

    await expect(
      reporter.phase({
        phase: 'preparing',
        operation: 'list explores',
        message: 'Preparing to list explores',
      }),
    ).resolves.toBeUndefined();
  });

  it('sends monotonic progress notifications for a request-scoped token', async () => {
    const notify = vi.fn().mockResolvedValue(undefined);
    const reporter = createOperationReporter({
      mcpReq: { _meta: { progressToken: 'progress-1' }, notify },
    } as unknown as ServerContext);

    await reporter.phase({
      phase: 'preparing',
      operation: 'list explores',
      message: 'Preparing to list explores',
      completedUnits: 1,
      totalUnits: 4,
    });
    await reporter.phase({
      phase: 'calling-service',
      operation: 'list explores',
      message: 'Loading explores from Lightdash',
      completedUnits: 1,
      totalUnits: 4,
    });

    expect(notify).toHaveBeenNthCalledWith(1, {
      method: 'notifications/progress',
      params: {
        progressToken: 'progress-1',
        progress: 1,
        total: 4,
        message: 'Preparing to list explores',
      },
    });
    expect(notify).toHaveBeenNthCalledWith(2, {
      method: 'notifications/progress',
      params: {
        progressToken: 'progress-1',
        progress: 2,
        total: 4,
        message: 'Loading explores from Lightdash',
      },
    });
  });

  it('does not fail the operation when notification delivery fails', async () => {
    const reporter = createOperationReporter({
      mcpReq: {
        _meta: { progressToken: 7 },
        notify: vi.fn().mockRejectedValue(new Error('disconnected')),
      },
    } as unknown as ServerContext);

    await expect(
      reporter.phase({
        phase: 'waiting',
        operation: 'run query',
        message: 'Waiting for Lightdash',
      }),
    ).resolves.toBeUndefined();
  });
});
