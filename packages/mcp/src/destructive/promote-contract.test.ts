/**
 * MRTR / elicitation contract for dashboard promote (ADR-0017).
 */
import { Client, isInputRequiredResult } from '@modelcontextprotocol/client';
import {
  CLIENT_CAPABILITIES_META_KEY,
  InMemoryTransport,
  McpServer,
} from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerPromoteDashboard } from '../tools/project/promote-dashboard.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import {
  getDestructiveRequestStateCodec,
  resetDestructiveRequestStateCodecForTests,
} from './request-state.js';
import { CONFIRM_PROMOTE_INPUT_KEY } from './types.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { ToolHandler } from '../tools/shared.js';
import type { Dashboard, LightdashClient } from '@lightdash-tools/client';
import type {
  CallToolResult,
  ClientCapabilities,
  ElicitResult,
} from '@modelcontextprotocol/client';
import type { ServerContext } from '@modelcontextprotocol/server';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const DASHBOARD_UUID = '44444444-4444-4444-8444-444444444444';
const DASHBOARD_NAME = 'Exec Overview';

type PromoteTracker = {
  getCount: number;
  diffCount: number;
  promoteCount: number;
  diffMutations: number;
};

function fixedDashboard(): Dashboard {
  return {
    uuid: DASHBOARD_UUID,
    slug: 'exec-overview',
    name: DASHBOARD_NAME,
    projectUuid: PROJECT_UUID,
    spaceUuid: '55555555-5555-4555-8555-555555555555',
    spaceName: 'Executive',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as Dashboard;
}

function fixedDiff(tracker: PromoteTracker) {
  return {
    charts: [
      {
        data: { name: 'KPI', uuid: 'c1' },
        action: tracker.diffMutations > 0 ? ('update' as const) : ('create' as const),
      },
    ],
    dashboards: [
      { data: { name: DASHBOARD_NAME, uuid: DASHBOARD_UUID }, action: 'update' as const },
    ],
    spaces: [],
  };
}

function createFakeClient(
  tracker: PromoteTracker,
  options: { promoteError?: Error } = {},
): LightdashClient {
  const dashboard = fixedDashboard();
  return {
    v2: {
      dashboards: {
        getDashboard: async () => {
          tracker.getCount += 1;
          return dashboard;
        },
      },
    },
    v1: {
      dashboards: {
        getDashboardPromoteDiff: async () => {
          tracker.diffCount += 1;
          return fixedDiff(tracker);
        },
        promoteDashboard: async () => {
          tracker.promoteCount += 1;
          if (options.promoteError) {
            throw options.promoteError;
          }
          return {
            ...dashboard,
            projectUuid: '99999999-9999-4999-8999-999999999999',
          };
        },
      },
    },
  } as unknown as LightdashClient;
}

function parseStructured(result: CallToolResult): Record<string, unknown> {
  if (result.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent as Record<string, unknown>;
  }
  const first = result.content[0];
  if (first && typeof first === 'object' && 'text' in first) {
    return JSON.parse(String((first as { text: string }).text)) as Record<string, unknown>;
  }
  throw new Error('Expected structured or JSON text tool result');
}

async function connectPair(options: {
  tracker: PromoteTracker;
  capabilities?: ClientCapabilities;
  promoteError?: Error;
}): Promise<{
  server: McpServer;
  mcpClient: Client;
}> {
  const codec = getDestructiveRequestStateCodec();
  const server = new McpServer(
    { name: 'promote-contract', version: '0.0.0' },
    {
      requestState: {
        verify: (state, ctx) => codec.verify(state, ctx),
      },
    },
  );

  const contextProvider: McpContextProvider = {
    getContext: async () => ({
      lightdashClient: createFakeClient(options.tracker, {
        promoteError: options.promoteError,
      }),
      auth: { mode: 'env' as const },
    }),
  };
  registerPromoteDashboard(server, contextProvider);

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const mcpClient = new Client(
    { name: 'promote-contract-client', version: '0.0.0' },
    {
      capabilities: options.capabilities ?? {},
    },
  );
  await mcpClient.connect(clientTransport);

  return { server, mcpClient };
}

describe('destructive MRTR contract (promote_dashboard)', () => {
  let server: McpServer | undefined;
  let mcpClient: Client | undefined;

  beforeEach(() => {
    resetDestructiveRequestStateCodecForTests();
    process.env.NODE_ENV = 'test';
  });

  afterEach(async () => {
    await mcpClient?.close().catch(() => undefined);
    await server?.close().catch(() => undefined);
    mcpClient = undefined;
    server = undefined;
    resetDestructiveRequestStateCodecForTests();
  });

  it('handler returns InputRequiredResult before elicitation is fulfilled', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const captured: { handler?: ToolHandler } = {};
    const captureServer = {
      registerTool: (_name: string, _options: unknown, handler: ToolHandler) => {
        captured.handler = handler;
      },
      server: {
        getClientCapabilities: () => ({ elicitation: { form: {} } }),
      },
    };

    const contextProvider: McpContextProvider = {
      getContext: async () => ({
        lightdashClient: createFakeClient(tracker),
        auth: { mode: 'env' as const },
      }),
    };
    registerPromoteDashboard(captureServer as unknown as McpServer, contextProvider);

    const serverContext = {
      mcpReq: {
        envelope: {
          [CLIENT_CAPABILITIES_META_KEY]: { elicitation: { form: {} } },
        },
        inputResponses: undefined,
        requestState: () => undefined,
      },
    } as unknown as ServerContext;

    const result = await captured.handler!(
      { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
      serverContext,
    );

    expect(isInputRequiredResult(result)).toBe(true);
    if (!isInputRequiredResult(result)) {
      return;
    }
    expect(result.requestState).toEqual(expect.any(String));
    expect(result.inputRequests?.[CONFIRM_PROMOTE_INPUT_KEY]).toBeDefined();
    expect(tracker.promoteCount).toBe(0);
    expect(tracker.getCount).toBe(1);
    expect(tracker.diffCount).toBe(1);
  });

  it('decline does not call promote', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'decline',
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}promote_dashboard`,
      arguments: { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
    });

    expect(tracker.promoteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('declined');
    expect(body.promoted).toBe(false);
  });

  it('accept with wrong name is blocked and does not promote', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'accept',
      content: {
        decision: 'confirm_promote',
        confirmationText: 'Wrong Name',
      },
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}promote_dashboard`,
      arguments: { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
    });

    expect(tracker.promoteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('blocked');
    expect(body.code).toBe('CONFIRMATION_INVALID');
  });

  it('accept with stable binding promotes once', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'accept',
      content: {
        decision: 'confirm_promote',
        confirmationText: DASHBOARD_NAME,
      },
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}promote_dashboard`,
      arguments: { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
    });

    expect(tracker.promoteCount).toBe(1);
    const body = parseStructured(result);
    expect(body.status).toBe('promoted');
    expect(body.promoted).toBe(true);
    expect(body.resourceName).toBe(DASHBOARD_NAME);
    expect(body.upstream).toEqual(
      expect.objectContaining({
        uuid: DASHBOARD_UUID,
        projectUuid: '99999999-9999-4999-8999-999999999999',
      }),
    );
  });

  it('returns a generic error when promote execution fails', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
      promoteError: new Error('secret upstream detail'),
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'accept',
      content: {
        decision: 'confirm_promote',
        confirmationText: DASHBOARD_NAME,
      },
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}promote_dashboard`,
      arguments: { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
    });

    expect(tracker.promoteCount).toBe(1);
    const body = parseStructured(result);
    expect(body.code).toBe('PROMOTION_FAILED');
    expect(body.message).toBe(
      'Dashboard promote failed. Retry after reviewing promoteDiff, or check server logs.',
    );
    expect(String(body.message)).not.toContain('secret');
  });

  it('accept with drifted promoteDiff returns RESOURCE_CHANGED', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => {
      // Mutate diff between mint and accept revalidation.
      tracker.diffMutations += 1;
      return {
        action: 'accept',
        content: {
          decision: 'confirm_promote',
          confirmationText: DASHBOARD_NAME,
        },
      };
    });

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}promote_dashboard`,
      arguments: { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
    });

    expect(tracker.promoteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('blocked');
    expect(body.code).toBe('RESOURCE_CHANGED');
  });

  it('blocks with ELICITATION_REQUIRED when form elicitation is not declared', async () => {
    const tracker: PromoteTracker = {
      getCount: 0,
      diffCount: 0,
      promoteCount: 0,
      diffMutations: 0,
    };
    const pair = await connectPair({
      tracker,
      capabilities: {},
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}promote_dashboard`,
      arguments: { projectUuid: PROJECT_UUID, dashboardUuidOrSlug: DASHBOARD_UUID },
    });

    expect(tracker.promoteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('blocked');
    expect(body.code).toBe('ELICITATION_REQUIRED');
  });
});
