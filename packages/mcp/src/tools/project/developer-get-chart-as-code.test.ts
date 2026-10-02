/**
 * Unit tests for get_chart_as_code registration handler.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveProjectScopeMock, registerContentDeveloperToolMock } = vi.hoisted(() => ({
  resolveProjectScopeMock: vi.fn(),
  registerContentDeveloperToolMock: vi.fn(),
}));

vi.mock('../../governance/project-scope.js', () => ({
  resolveProjectScope: resolveProjectScopeMock,
}));

vi.mock('../../policy/content-developer.js', () => ({
  DISCOVERY_SAFETY: { mode: 'discovery' },
  registerContentDeveloperTool: registerContentDeveloperToolMock,
}));

vi.mock('./developer-content-shared.js', () => ({
  developerContext: (scope: { projectUuid: string; projectPinned: boolean }) => ({
    profile: 'content-developer',
    projectUuid: scope.projectUuid,
    projectPinned: scope.projectPinned,
  }),
  wrapDeveloperHandler: (
    _ctx: unknown,
    fn: (ctx: { client: unknown }) => (args: unknown) => Promise<unknown>,
  ) => fn,
}));

import { registerGetChartAsCode } from './developer-get-chart-as-code.js';

describe('registerGetChartAsCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveProjectScopeMock.mockReturnValue({
      projectUuid: 'proj-1',
      projectPinned: false,
    });
  });

  it('returns the first as-code chart for the requested id', async () => {
    const chart = { slug: 'orders-bar', name: 'Orders' };
    const getChartsAsCode = vi.fn().mockResolvedValue({ charts: [chart] });
    let handler:
      | ((ctx: {
          client: { v1: { charts: { getChartsAsCode: typeof getChartsAsCode } } };
        }) => (args: { chartUuidOrSlug: string }) => Promise<unknown>)
      | undefined;

    registerContentDeveloperToolMock.mockImplementation(
      (_server: unknown, _name: unknown, _meta: unknown, wrapped: typeof handler) => {
        handler = wrapped as typeof handler;
      },
    );

    registerGetChartAsCode({} as never, {} as never);
    expect(handler).toBeDefined();
    const result = await handler!({
      client: { v1: { charts: { getChartsAsCode } } },
    })({ chartUuidOrSlug: 'orders-bar' });

    expect(getChartsAsCode).toHaveBeenCalledWith('proj-1', { ids: ['orders-bar'] });
    expect(result).toMatchObject({
      content: expect.any(Array),
    });
    const payload = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
    expect(payload.data.chart).toEqual(chart);
    expect(payload.context.projectUuid).toBe('proj-1');
  });

  it('returns CONTENT_NOT_FOUND when the as-code list is empty', async () => {
    const getChartsAsCode = vi.fn().mockResolvedValue({ charts: [] });
    let handler:
      | ((ctx: {
          client: { v1: { charts: { getChartsAsCode: typeof getChartsAsCode } } };
        }) => (args: { chartUuidOrSlug: string }) => Promise<unknown>)
      | undefined;

    registerContentDeveloperToolMock.mockImplementation(
      (_server: unknown, _name: unknown, _meta: unknown, wrapped: typeof handler) => {
        handler = wrapped as typeof handler;
      },
    );

    registerGetChartAsCode({} as never, {} as never);
    const result = await handler!({
      client: { v1: { charts: { getChartsAsCode } } },
    })({ chartUuidOrSlug: 'missing' });

    const payload = JSON.parse((result as { content: Array<{ text: string }> }).content[0].text);
    expect(payload.error?.code ?? payload.code).toBeDefined();
    expect(JSON.stringify(payload)).toContain('CONTENT_NOT_FOUND');
  });
});
