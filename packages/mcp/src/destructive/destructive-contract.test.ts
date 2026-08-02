/**
 * MRTR / elicitation contract for soft-delete (ADR-0015).
 *
 * @modelcontextprotocol/server@2.0.0 ships 2025-era protocol versions by default.
 * Handlers still return `inputRequired(...)`; on 2025 connections the SDK legacy
 * shim turns that into a server→client `elicitation/create`, then re-enters the
 * handler with `inputResponses` + echoed `requestState`.
 *
 * Client auto-fulfillment: register `setRequestHandler('elicitation/create', ...)`.
 * With autoFulfill (default true) the client answers shimmed elicitations during
 * `callTool`. Pinning `2026-07-28` is not available on this server package build
 * (`SUPPORTED_PROTOCOL_VERSIONS` is 2025-only).
 */
import { Client, isInputRequiredResult } from '@modelcontextprotocol/client';
import {
  CLIENT_CAPABILITIES_META_KEY,
  InMemoryTransport,
  McpServer,
} from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerDeleteChart } from '../tools/project/delete-chart.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import {
  getDestructiveRequestStateCodec,
  resetDestructiveRequestStateCodecForTests,
} from './request-state.js';
import { CONFIRM_INPUT_KEY } from './types.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { ToolHandler } from '../tools/shared.js';
import type { LightdashClient, SavedChart } from '@lightdash-tools/client';
import type {
  CallToolResult,
  ClientCapabilities,
  ElicitResult,
} from '@modelcontextprotocol/client';
import type { ServerContext } from '@modelcontextprotocol/server';

const PROJECT_UUID = '11111111-1111-4111-8111-111111111111';
const CHART_UUID = '22222222-2222-4222-8222-222222222222';
const CHART_NAME = 'Revenue KPI';

type DeleteTracker = {
  getCount: number;
  deleteCount: number;
};

function fixedChartSnapshot(): SavedChart {
  return {
    uuid: CHART_UUID,
    slug: 'revenue-kpi',
    name: CHART_NAME,
    projectUuid: PROJECT_UUID,
    spaceUuid: '33333333-3333-4333-8333-333333333333',
    spaceName: 'Finance',
    updatedAt: '2026-08-01T00:00:00.000Z',
  } as SavedChart;
}

function createFakeClient(tracker: DeleteTracker): LightdashClient {
  const chart = fixedChartSnapshot();
  return {
    v2: {
      charts: {
        getSavedChart: async () => {
          tracker.getCount += 1;
          return chart;
        },
        deleteSavedChart: async () => {
          tracker.deleteCount += 1;
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
  tracker: DeleteTracker;
  capabilities?: ClientCapabilities;
}): Promise<{
  server: McpServer;
  mcpClient: Client;
}> {
  const codec = getDestructiveRequestStateCodec();
  const server = new McpServer(
    { name: 'destructive-contract', version: '0.0.0' },
    {
      requestState: {
        verify: (state, ctx) => codec.verify(state, ctx),
      },
    },
  );

  const contextProvider: McpContextProvider = {
    getContext: async () => ({
      lightdashClient: createFakeClient(options.tracker),
      auth: { mode: 'env' as const },
    }),
  };
  registerDeleteChart(server, contextProvider);

  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  const mcpClient = new Client(
    { name: 'destructive-contract-client', version: '0.0.0' },
    {
      capabilities: options.capabilities ?? {},
    },
  );
  await mcpClient.connect(clientTransport);

  return { server, mcpClient };
}

describe('destructive MRTR contract (delete_chart)', () => {
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
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
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
    registerDeleteChart(captureServer as unknown as McpServer, contextProvider);
    expect(captured.handler).toBeTypeOf('function');

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
      { projectUuid: PROJECT_UUID, chartUuidOrSlug: CHART_UUID },
      serverContext,
    );

    expect(isInputRequiredResult(result)).toBe(true);
    if (!isInputRequiredResult(result)) {
      return;
    }
    expect(result.requestState).toEqual(expect.any(String));
    expect(result.inputRequests?.[CONFIRM_INPUT_KEY]).toBeDefined();
    expect(tracker.deleteCount).toBe(0);
    expect(tracker.getCount).toBe(1);
  });

  it('decline does not call DELETE', async () => {
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
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
      name: `${TOOL_PREFIX}delete_chart`,
      arguments: { projectUuid: PROJECT_UUID, chartUuidOrSlug: CHART_UUID },
    });

    expect(tracker.deleteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('declined');
    expect(body.deleted).toBe(false);
  });

  it('cancel does not call DELETE', async () => {
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'cancel',
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}delete_chart`,
      arguments: { projectUuid: PROJECT_UUID, chartUuidOrSlug: CHART_UUID },
    });

    expect(tracker.deleteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('cancelled');
    expect(body.deleted).toBe(false);
  });

  it('accept with wrong name is blocked and does not DELETE', async () => {
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'accept',
      content: {
        decision: 'confirm_delete',
        confirmationText: 'Wrong Name',
      },
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}delete_chart`,
      arguments: { projectUuid: PROJECT_UUID, chartUuidOrSlug: CHART_UUID },
    });

    expect(tracker.deleteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('blocked');
    expect(body.code).toBe('CONFIRMATION_INVALID');
  });

  it('accept with stable binding soft-deletes once', async () => {
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'accept',
      content: {
        decision: 'confirm_delete',
        confirmationText: CHART_NAME,
      },
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}delete_chart`,
      arguments: { projectUuid: PROJECT_UUID, chartUuidOrSlug: CHART_UUID },
    });

    expect(tracker.deleteCount).toBe(1);
    const body = parseStructured(result);
    expect(body.status).toBe('deleted');
    expect(body.resourceId).toBe(CHART_UUID);
    expect(body.resourceName).toBe(CHART_NAME);
  });

  it('accept by slug soft-deletes when snapshot has a different uuid', async () => {
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
    const pair = await connectPair({
      tracker,
      capabilities: { elicitation: { form: {} } },
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    mcpClient.setRequestHandler('elicitation/create', async (): Promise<ElicitResult> => ({
      action: 'accept',
      content: {
        decision: 'confirm_delete',
        confirmationText: CHART_NAME,
      },
    }));

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}delete_chart`,
      arguments: { projectUuid: PROJECT_UUID, chartUuidOrSlug: 'revenue-kpi' },
    });

    expect(tracker.deleteCount).toBe(1);
    const body = parseStructured(result);
    expect(body.status).toBe('deleted');
    expect(body.resourceId).toBe(CHART_UUID);
  });

  it('blocks with ELICITATION_REQUIRED when form elicitation is not declared', async () => {
    const tracker: DeleteTracker = { getCount: 0, deleteCount: 0 };
    const pair = await connectPair({
      tracker,
      capabilities: {},
    });
    server = pair.server;
    mcpClient = pair.mcpClient;

    const result = await mcpClient.callTool({
      name: `${TOOL_PREFIX}delete_chart`,
      arguments: { projectUuid: PROJECT_UUID, chartUuidOrSlug: CHART_UUID },
    });

    expect(tracker.deleteCount).toBe(0);
    const body = parseStructured(result);
    expect(body.status).toBe('blocked');
    expect(body.code).toBe('ELICITATION_REQUIRED');
  });
});
