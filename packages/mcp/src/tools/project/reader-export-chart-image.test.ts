/**
 * Unit tests for export_chart_image registration handler.
 */

import { ChartImageSizeError } from '@lightdash-tools/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveProjectScopeMock,
  registerContentReaderToolMock,
  wrapToolMock,
  classifyChartSourceMock,
  acquireQueryBudgetMock,
  releaseQueryBudgetMock,
} = vi.hoisted(() => ({
  resolveProjectScopeMock: vi.fn(),
  registerContentReaderToolMock: vi.fn(),
  wrapToolMock: vi.fn(),
  classifyChartSourceMock: vi.fn(),
  acquireQueryBudgetMock: vi.fn(),
  releaseQueryBudgetMock: vi.fn(),
}));

vi.mock('../../governance/project-scope.js', () => ({
  resolveProjectScope: resolveProjectScopeMock,
  ProjectScopeError: class ProjectScopeError extends Error {
    code = 'PROJECT_SCOPE_REQUIRED';
  },
}));

vi.mock('../../governance/mcp-client-session.js', () => ({
  getMcpClientSessionId: () => 'test-session',
}));

vi.mock('../../audit/tool-audit-context.js', () => ({
  getToolAuditAuth: () => undefined,
}));

vi.mock('../../policy/result-limits.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    acquireQueryBudget: acquireQueryBudgetMock,
    releaseQueryBudget: releaseQueryBudgetMock,
  };
});

vi.mock('../query/chart-source.js', () => ({
  classifyChartSource: classifyChartSourceMock,
}));

vi.mock('../../policy/content-reader.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    registerContentReaderTool: registerContentReaderToolMock,
  };
});

vi.mock('../shared.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    wrapTool: wrapToolMock,
  };
});

import { registerExportChartImage } from './reader-export-chart-image.js';

describe('registerExportChartImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProjectScopeMock.mockReturnValue({
      projectUuid: 'proj-1',
      projectPinned: false,
    });
    classifyChartSourceMock.mockResolvedValue('semantic');
    wrapToolMock.mockImplementation(
      (_ctx: unknown, factory: (c: unknown) => (args: unknown) => Promise<unknown>) => {
        return async (args: unknown) => {
          const client = (wrapToolMock as { __client?: unknown }).__client;
          return factory(client)(args);
        };
      },
    );
  });

  function captureHandler(
    client: unknown,
  ): (args: { chartUuid: string; projectUuid?: string }) => Promise<unknown> {
    (wrapToolMock as { __client?: unknown }).__client = client;
    let handler:
      ((args: { chartUuid: string; projectUuid?: string }) => Promise<unknown>) | undefined;
    registerContentReaderToolMock.mockImplementation(
      (
        _server: unknown,
        _name: unknown,
        _meta: unknown,
        createHandler: (profile: string) => typeof handler,
      ) => {
        handler = createHandler('content-reader');
      },
    );
    registerExportChartImage({} as never, {} as never);
    expect(handler).toBeDefined();
    return handler!;
  }

  function semanticClient(exportChartImagePng: unknown) {
    return {
      v1: { charts: { exportChartImagePng } },
      v2: {
        charts: {
          getSavedChart: vi.fn().mockResolvedValue({
            uuid: 'chart-1',
            metricQuery: { dimensions: [], metrics: [] },
            chartConfig: { type: 'cartesian' },
          }),
        },
      },
    };
  }

  it('returns MCP image content with metadata', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const exportChartImagePng = vi.fn().mockResolvedValue({
      imageUrl: 'https://cdn.example/chart.png',
      bytes: png,
      mimeType: 'image/png',
    });
    const handler = captureHandler(semanticClient(exportChartImagePng));
    const result = (await handler({ chartUuid: 'chart-1' })) as {
      content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
      structuredContent?: Record<string, unknown>;
    };

    expect(exportChartImagePng).toHaveBeenCalledWith('chart-1', 'proj-1');
    expect(acquireQueryBudgetMock).toHaveBeenCalled();
    expect(releaseQueryBudgetMock).toHaveBeenCalled();
    expect(result.content).toHaveLength(2);
    expect(result.content[0]?.type).toBe('text');
    expect(result.content[1]).toEqual({
      type: 'image',
      data: png.toString('base64'),
      mimeType: 'image/png',
    });
    expect(result.structuredContent).toMatchObject({
      chartUuid: 'chart-1',
      projectUuid: 'proj-1',
      mimeType: 'image/png',
      byteLength: png.byteLength,
    });
    expect(result.structuredContent).not.toHaveProperty('imageUrl');
    expect(JSON.stringify(result.structuredContent)).not.toContain(png.toString('base64'));
    expect(JSON.stringify(result.structuredContent)).not.toContain('cdn.example');
  });

  it('returns CONTENT_NOT_EXECUTABLE for SQL charts', async () => {
    classifyChartSourceMock.mockResolvedValue('sql');
    const exportChartImagePng = vi.fn();
    const handler = captureHandler(semanticClient(exportChartImagePng));
    const result = (await handler({ chartUuid: 'sql-1' })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBe(true);
    expect(exportChartImagePng).not.toHaveBeenCalled();
    expect(acquireQueryBudgetMock).not.toHaveBeenCalled();
    const payload = JSON.parse(result.content[0]?.text ?? '{}') as {
      error?: { code?: string };
    };
    expect(payload.error?.code).toBe('CONTENT_NOT_EXECUTABLE');
  });

  it('returns IMAGE_TOO_LARGE on size cap', async () => {
    const exportChartImagePng = vi
      .fn()
      .mockRejectedValue(new ChartImageSizeError(8_000_000, 9_000_000));
    const handler = captureHandler(semanticClient(exportChartImagePng));
    const result = (await handler({ chartUuid: 'chart-1' })) as {
      isError?: boolean;
      content: Array<{ type: string; text?: string }>;
    };
    expect(result.isError).toBe(true);
    expect(releaseQueryBudgetMock).toHaveBeenCalled();
    const payload = JSON.parse(result.content[0]?.text ?? '{}') as {
      error?: { code?: string };
    };
    expect(payload.error?.code).toBe('IMAGE_TOO_LARGE');
  });

  it('registers with IMAGE_SNAPSHOT_SAFETY and export_chart_image name', () => {
    captureHandler(semanticClient(vi.fn()));
    expect(registerContentReaderToolMock).toHaveBeenCalledWith(
      expect.anything(),
      'export_chart_image',
      expect.objectContaining({
        safety: expect.objectContaining({ resultCapability: 'image_snapshot' }),
      }),
      expect.any(Function),
    );
  });
});
