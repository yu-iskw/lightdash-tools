import { logAuditEntry } from '@lightdash-tools/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { runWithProjectPinAsync } from '../governance/project-pin.js';

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT, TOOL_PREFIX } from './shared.js';

import type { McpContextProvider } from '../server/request-context.js';

// Silence audit log output during tests
vi.mock('@lightdash-tools/common', async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actual = await importOriginal<any>();
  return {
    ...actual,
    getSessionId: () => 'test-session',
    logAuditEntry: vi.fn(),
    initAuditLog: vi.fn(),
  };
});

const PROJECT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PROJECT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('registerToolSafe', () => {
  const mockServer = {
    registerTool: vi.fn(),
  };

  const mockHandler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'success' }] });

  beforeEach(() => {
    mockServer.registerTool.mockClear();
    mockHandler.mockClear();
    vi.mocked(logAuditEntry).mockClear();
  });

  it('registers tools and invokes the handler', async () => {
    registerToolSafe(
      mockServer,
      'test_tool',
      {
        description: 'Test description',
        inputSchema: {},
        annotations: READ_ONLY_DEFAULT,
      },
      mockHandler,
    );

    expect(mockServer.registerTool).toHaveBeenCalled();
    const [name, options, handler] = mockServer.registerTool.mock.calls[0];

    expect(name).toContain('test_tool');
    expect(options.description).toBe('Test description');

    const result = await handler({});
    expect(result.content[0].text).toBe('success');
  });

  it('allows tools when OAuth subject is present (no local JWT scope gate)', async () => {
    const contextProvider = {
      getContext: async () => ({
        lightdashClient: {},
        auth: {
          mode: 'lightdash-oauth' as const,
          tokenHash: 'hash-abc',
          subject: 'user-1',
        },
      }),
    } as unknown as McpContextProvider;

    const wrapped = wrapTool(contextProvider, () => async () => ({
      content: [{ type: 'text', text: 'success' }],
    }));

    const result = await wrapped({});
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('success');
  });

  it('should reject invalid projectUuid before calling handler', async () => {
    registerToolSafe(
      mockServer,
      'list_tool',
      {
        description: 'List something',
        inputSchema: {},
        annotations: READ_ONLY_DEFAULT,
      },
      mockHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await handler({ projectUuid: 'uuid?fields=name' });

    expect(mockHandler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid resource ID');
  });

  describe('HTTP project pin', () => {
    it('allows matching projectUuid when pin is set', async () => {
      registerToolSafe(
        mockServer,
        'pinned_ok',
        { description: 'Get project', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];

      await runWithProjectPinAsync(PROJECT_A, async () => {
        const result = await handler({ projectUuid: PROJECT_A });
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toBe('success');
      });
    });

    it('blocks mismatched projectUuid when pin is set', async () => {
      registerToolSafe(
        mockServer,
        'pinned_block',
        { description: 'Get project', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];

      await runWithProjectPinAsync(PROJECT_A, async () => {
        const result = await handler({ projectUuid: PROJECT_B });
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('do not match the pinned project');
        expect(result.content[0].text).toContain(PROJECT_A);
        expect(result.content[0].text).toContain(PROJECT_B);
        expect('_lightdashBlocked' in result).toBe(false);
        expect(logAuditEntry).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'blocked', tool: `${TOOL_PREFIX}pinned_block` }),
        );
      });
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('allows tools with no projectUuid when pin is set', async () => {
      registerToolSafe(
        mockServer,
        'pinned_no_uuid',
        { description: 'List', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];

      await runWithProjectPinAsync(PROJECT_A, async () => {
        const result = await handler({});
        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toBe('success');
      });
    });
  });

  it('should reject invalid slug before calling handler', async () => {
    registerToolSafe(
      mockServer,
      'slug_tool',
      { description: 'Uses slug', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
      mockHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await handler({ slug: 'bad?slug' });

    expect(mockHandler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Slug must');
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blocked', tool: `${TOOL_PREFIX}slug_tool` }),
    );
  });

  it('should reject invalid projectUuids array entries before calling handler', async () => {
    registerToolSafe(
      mockServer,
      'plural_uuid_tool',
      { description: 'Uses projectUuids', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
      mockHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await handler({ projectUuids: [PROJECT_A, 'not-a-uuid'] });

    expect(mockHandler).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid UUID');
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'blocked', tool: `${TOOL_PREFIX}plural_uuid_tool` }),
    );
  });

  it('should rethrow when the audited handler throws', async () => {
    const failingHandler = vi.fn().mockRejectedValue(new Error('boom'));
    registerToolSafe(
      mockServer,
      'throws_tool',
      { description: 'Throws', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
      failingHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    await expect(handler({})).rejects.toThrow('boom');
  });

  it('should mark audit status error when handler returns isError', async () => {
    const errorHandler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'failed' }],
      isError: true,
    });
    registerToolSafe(
      mockServer,
      'error_result_tool',
      { description: 'Returns error', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
      errorHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await handler({});
    expect(result.isError).toBe(true);
  });

  it('should attach structuredContent when handler returns JSON text', async () => {
    const jsonHandler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ ok: true }) }],
    });
    registerToolSafe(
      mockServer,
      'json_tool',
      { description: 'Returns JSON', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
      jsonHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await handler({});

    expect(result.structuredContent).toEqual({ ok: true });
    expect(JSON.parse(result.content[0].text)).toEqual({ ok: true });
  });

  it('should wrap array JSON in structuredContent.data', async () => {
    const jsonHandler = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify([{ id: 'a' }]) }],
    });
    registerToolSafe(
      mockServer,
      'json_array_tool',
      { description: 'Returns JSON array', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
      jsonHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    const result = await handler({});

    expect(result.structuredContent).toEqual({ data: [{ id: 'a' }] });
    expect(JSON.parse(result.content[0].text)).toEqual([{ id: 'a' }]);
  });

  it('wrapTool returns a safe error message when the inner handler throws', async () => {
    const contextProvider = {
      getContext: async () => ({
        lightdashClient: {},
        auth: { mode: 'none' as const },
      }),
    } as unknown as McpContextProvider;
    const wrapped = wrapTool(contextProvider, () => async () => {
      throw new Error('boom');
    });

    const result = await wrapped({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('boom');
  });
});
