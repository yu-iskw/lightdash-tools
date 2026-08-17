/**
 * Opaque SQL metadata path for get_chart on content-reader.
 */

import { LightdashApiError } from '@lightdash-tools/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resolveProjectScopeMock,
  registerContentReaderToolMock,
  wrapToolMock,
  resolveChartSourceMock,
} = vi.hoisted(() => ({
  resolveProjectScopeMock: vi.fn(),
  registerContentReaderToolMock: vi.fn(),
  wrapToolMock: vi.fn(),
  resolveChartSourceMock: vi.fn(),
}));

vi.mock('../../governance/project-scope.js', () => ({
  resolveProjectScope: resolveProjectScopeMock,
  ProjectScopeError: class ProjectScopeError extends Error {
    code = 'PROJECT_SCOPE_REQUIRED';
  },
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

vi.mock('../query/chart-source.js', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- vitest importOriginal typing
  const actual = await importOriginal<any>();
  return {
    ...actual,
    resolveChartSource: resolveChartSourceMock,
  };
});

import { registerGetChart } from './reader-content.js';

describe('registerGetChart opaque SQL', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProjectScopeMock.mockReturnValue({
      projectUuid: 'proj-1',
      projectPinned: false,
    });
    wrapToolMock.mockImplementation(
      (_ctx: unknown, factory: (c: unknown) => (args: unknown) => Promise<unknown>) => {
        return async (args: unknown) => {
          const client = (wrapToolMock as { __client?: unknown }).__client;
          return factory(client)(args);
        };
      },
    );
  });

  it('returns opaque metadata without calling getSavedChart for SQL charts', async () => {
    const getSavedChart = vi.fn();
    resolveChartSourceMock.mockResolvedValue({
      class: 'sql',
      uuid: 'sql-1',
      slug: 'cost',
      name: 'Cost',
    });

    (wrapToolMock as { __client?: unknown }).__client = {
      v2: { charts: { getSavedChart } },
    };
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
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
    registerGetChart({} as never, {} as never);
    expect(handler).toBeDefined();

    const result = await handler!({ chartUuidOrSlug: 'sql-1' });
    const body = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as {
      data: { chartType: string; name?: string };
      warnings: Array<{ code: string }>;
    };

    expect(getSavedChart).not.toHaveBeenCalled();
    expect(body.data.chartType).toBe('sql');
    expect(body.data.name).toBe('Cost');
    expect(body.warnings.some((w) => w.code === 'SQL_BODY_REDACTED')).toBe(true);
    expect(JSON.stringify(body.data)).not.toMatch(/"sql"\s*:/);
  });

  it('returns opaque metadata when search misses and semantic GET 404s', async () => {
    const getSavedChart = vi
      .fn()
      .mockRejectedValue(
        new LightdashApiError(
          404,
          { name: 'NotFoundError', statusCode: 404, message: 'Saved query not found' },
          {},
        ),
      );
    resolveChartSourceMock.mockResolvedValue({ class: 'unknown' });
    (wrapToolMock as { __client?: unknown }).__client = {
      v2: { charts: { getSavedChart } },
    };
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
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
    registerGetChart({} as never, {} as never);

    const result = await handler!({
      chartUuidOrSlug: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    const body = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as {
      data: { chartType: string; uuid: string };
      warnings: Array<{ code: string }>;
    };

    expect(getSavedChart).toHaveBeenCalled();
    expect(body.data.chartType).toBe('sql');
    expect(body.data.uuid).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(body.warnings.some((w) => w.code === 'SQL_BODY_REDACTED')).toBe(true);
  });

  it('returns CONTENT_NOT_FOUND on content-developer when semantic GET 404s', async () => {
    const getSavedChart = vi
      .fn()
      .mockRejectedValue(
        new LightdashApiError(
          404,
          { name: 'NotFoundError', statusCode: 404, message: 'Saved query not found' },
          {},
        ),
      );
    resolveChartSourceMock.mockResolvedValue({ class: 'unknown' });
    (wrapToolMock as { __client?: unknown }).__client = {
      v2: { charts: { getSavedChart } },
    };
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
    registerContentReaderToolMock.mockImplementation(
      (
        _server: unknown,
        _name: unknown,
        _meta: unknown,
        createHandler: (profile: string) => typeof handler,
      ) => {
        handler = createHandler('content-developer');
      },
    );
    registerGetChart({} as never, {} as never);

    const result = await handler!({
      chartUuidOrSlug: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(JSON.stringify(result)).toContain('CONTENT_NOT_FOUND');
    expect(JSON.stringify(result)).not.toContain('run_chart');
  });

  it('returns UPSTREAM_NOT_FOUND with recovery when content-reader load throws 404', async () => {
    resolveChartSourceMock.mockRejectedValue(
      new LightdashApiError(
        404,
        { name: 'NotFoundError', statusCode: 404, message: 'Saved query not found' },
        {},
      ),
    );
    (wrapToolMock as { __client?: unknown }).__client = {
      v2: { charts: { getSavedChart: vi.fn() } },
    };
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
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
    registerGetChart({} as never, {} as never);

    const result = await handler!({ chartUuidOrSlug: 'missing-chart' });
    expect((result as { isError?: boolean }).isError).toBe(true);
    const body = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as {
      error: { code: string; recovery?: string; playbookUri?: string };
    };
    expect(body.error.code).toBe('UPSTREAM_NOT_FOUND');
    expect(body.error.recovery).toMatch(/run_dashboard_tile/);
    expect(body.error.playbookUri).toBe('lightdash://playbooks/content-reader/explain-run');
  });

  it('does not advertise run_chart on content-developer opaque SQL metadata', async () => {
    const getSavedChart = vi.fn();
    resolveChartSourceMock.mockResolvedValue({
      class: 'sql',
      uuid: 'sql-1',
      slug: 'cost',
      name: 'Cost',
    });
    (wrapToolMock as { __client?: unknown }).__client = {
      v2: { charts: { getSavedChart } },
    };
    let handler: ((args: Record<string, unknown>) => Promise<unknown>) | undefined;
    registerContentReaderToolMock.mockImplementation(
      (
        _server: unknown,
        _name: unknown,
        _meta: unknown,
        createHandler: (profile: string) => typeof handler,
      ) => {
        handler = createHandler('content-developer');
      },
    );
    registerGetChart({} as never, {} as never);

    const result = await handler!({ chartUuidOrSlug: 'sql-1' });
    const body = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text) as {
      data: { chartType: string; warnings?: string[] };
    };
    expect(getSavedChart).not.toHaveBeenCalled();
    expect(body.data.chartType).toBe('sql');
    expect(JSON.stringify(body.data)).not.toMatch(/run_chart/);
  });
});
