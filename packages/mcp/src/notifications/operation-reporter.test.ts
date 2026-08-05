import { describe, expect, it, vi } from 'vitest';

import { createOperationReporter } from './operation-reporter.js';

import type { ServerContext } from '@modelcontextprotocol/server';

describe('createOperationReporter', () => {
  it('is a no-op when the client did not provide a progress token', async () => {
    const sendNotification = vi.fn();
    const reporter = createOperationReporter({ sendNotification } as unknown as ServerContext);

    await reporter.phase({
      phase: 'preparing',
      operation: 'list explores',
      message: 'Preparing to list explores',
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends monotonic progress notifications for a request-scoped token', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const reporter = createOperationReporter({
      mcpReq: { _meta: { progressToken: 'progress-1' } },
      sendNotification,
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

    expect(sendNotification).toHaveBeenNthCalledWith(1, {
      method: 'notifications/progress',
      params: {
        progressToken: 'progress-1',
        progress: 1,
        total: 4,
        message: 'Preparing to list explores',
      },
    });
    expect(sendNotification).toHaveBeenNthCalledWith(2, {
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
      mcpReq: { _meta: { progressToken: 7 } },
      sendNotification: vi.fn().mockRejectedValue(new Error('disconnected')),
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
