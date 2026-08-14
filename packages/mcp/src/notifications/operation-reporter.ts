import type { ServerContext } from '@modelcontextprotocol/server';

export type OperationPhase =
  'calling-service' | 'completed' | 'preparing' | 'processing-response' | 'waiting';

export type OperationPhaseEvent = {
  phase: OperationPhase;
  operation: string;
  message: string;
  completedUnits?: number;
  totalUnits?: number;
};

export interface OperationReporter {
  phase(event: OperationPhaseEvent): Promise<void>;
}

type ProgressToken = number | string;

type ProgressNotification = {
  method: 'notifications/progress';
  params: {
    progressToken: ProgressToken;
    progress: number;
    total?: number;
    message?: string;
  };
};

type ProgressCapableContext = ServerContext & {
  mcpReq?: {
    _meta?: {
      progressToken?: ProgressToken;
    };
    notify?: (notification: ProgressNotification) => Promise<void>;
  };
};

class NoopOperationReporter implements OperationReporter {
  async phase(): Promise<void> {
    // Intentionally empty when the client did not opt in to progress notifications.
  }
}

class McpProgressOperationReporter implements OperationReporter {
  private current = 0;

  constructor(
    private readonly token: ProgressToken,
    private readonly notify: (notification: ProgressNotification) => Promise<void>,
  ) {}

  async phase(event: OperationPhaseEvent): Promise<void> {
    const requestedProgress = event.completedUnits ?? this.current + 1;
    this.current = Math.max(this.current + 1, requestedProgress);

    const params: ProgressNotification['params'] = {
      progressToken: this.token,
      progress: this.current,
      message: event.message,
    };
    if (event.totalUnits !== undefined) {
      params.total = event.totalUnits;
    }

    try {
      await this.notify({ method: 'notifications/progress', params });
    } catch {
      // Progress reporting is best-effort and must never fail the tool invocation.
    }
  }
}

export function createOperationReporter(context: ServerContext | undefined): OperationReporter {
  const progressContext = context;
  const mcpReq = progressContext?.mcpReq;
  const token = mcpReq?._meta?.progressToken;
  const notify = mcpReq?.notify;

  if (token === undefined || notify === undefined) {
    return new NoopOperationReporter();
  }

  return new McpProgressOperationReporter(token, notify.bind(mcpReq));
}
