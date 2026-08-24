import { LightdashApiError } from '@lightdash-tools/client';
import {
  ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS,
  WRITE_DESTRUCTIVE,
  logAuditEntry,
} from '@lightdash-tools/common';
import { afterEach, describe, it, expect, vi, beforeEach } from 'vitest';

import { bindServerProfile } from '../audit/server-profile.js';
import { resetAvailableProjectsCache } from '../governance/available-projects.js';
import { runWithProjectPinAsync } from '../governance/project-pin.js';

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT, TOOL_PREFIX } from './shared.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { ToolOptions } from './shared.js';

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

  afterEach(() => {
    delete process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS];
    resetAvailableProjectsCache();
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

  it('throws when annotations are omitted', () => {
    expect(() =>
      registerToolSafe(
        mockServer,
        'missing_annotations',
        {
          description: 'Missing annotations',
          inputSchema: {},
        } as ToolOptions,
        mockHandler,
      ),
    ).toThrow(/annotations.*readOnlyHint|readOnlyHint.*annotations/);
    expect(mockServer.registerTool).not.toHaveBeenCalled();
  });

  it('does not rewrite provided write annotations to read-only', () => {
    registerToolSafe(
      mockServer,
      'write_tool',
      {
        description: 'Write something',
        inputSchema: {},
        annotations: WRITE_DESTRUCTIVE,
      },
      mockHandler,
    );

    const [, options] = mockServer.registerTool.mock.calls[0];
    expect(options.annotations.readOnlyHint).toBe(false);
    expect(options.annotations).toMatchObject(WRITE_DESTRUCTIVE);
  });

  it('audit entry includes channel, clientSessionId, and profileId', async () => {
    bindServerProfile(mockServer, 'semantic-layer');
    registerToolSafe(
      mockServer,
      'audit_attrs',
      {
        description: 'Audit attrs',
        inputSchema: {},
        annotations: READ_ONLY_DEFAULT,
      },
      mockHandler,
    );

    const [, , handler] = mockServer.registerTool.mock.calls[0];
    await handler({}, { sessionId: 'mcp-client-session-9' });

    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'audit',
        severity: 'INFO',
        message: `${TOOL_PREFIX}audit_attrs success`,
        status: 'success',
        clientSessionId: 'mcp-client-session-9',
        profileId: 'semantic-layer',
        tool: `${TOOL_PREFIX}audit_attrs`,
      }),
    );
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
    expect(Array.isArray(result.content)).toBe(true);
    expect((result.content as Array<{ type: string; text: string }>)[0]?.text).toBe('success');
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

  describe('shared project allowlist (LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS)', () => {
    it('allows projectUuid in the allowlist', async () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = `${PROJECT_A},${PROJECT_B}`;
      resetAvailableProjectsCache();
      registerToolSafe(
        mockServer,
        'available_ok',
        { description: 'Get project', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: PROJECT_A });
      expect(result.isError).toBeUndefined();
      expect(mockHandler).toHaveBeenCalled();
    });

    it('blocks projectUuid outside the allowlist', async () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = PROJECT_A;
      resetAvailableProjectsCache();
      registerToolSafe(
        mockServer,
        'available_block',
        { description: 'Get project', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: PROJECT_B });
      expect(mockHandler).not.toHaveBeenCalled();
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('PROJECT_NOT_AVAILABLE');
      expect(result.content[0].text).toContain(PROJECT_B);
      expect(logAuditEntry).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'blocked', tool: `${TOOL_PREFIX}available_block` }),
      );
    });

    it('blocks pinned project outside the allowlist', async () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = PROJECT_A;
      resetAvailableProjectsCache();
      registerToolSafe(
        mockServer,
        'available_pin_block',
        { description: 'List', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];
      await runWithProjectPinAsync(PROJECT_B, async () => {
        const result = await handler({});
        expect(mockHandler).not.toHaveBeenCalled();
        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain('PROJECT_NOT_AVAILABLE');
        expect(result.content[0].text).toContain(PROJECT_B);
      });
    });

    it('allows tools with no projectUuid when allowlist is set', async () => {
      process.env[ENV_LIGHTDASH_TOOLS_ALLOWED_PROJECT_UUIDS] = PROJECT_A;
      resetAvailableProjectsCache();
      registerToolSafe(
        mockServer,
        'available_no_uuid',
        { description: 'Org list', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );
      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(mockHandler).toHaveBeenCalled();
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
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', tool: `${TOOL_PREFIX}throws_tool` }),
    );
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
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', tool: `${TOOL_PREFIX}error_result_tool` }),
    );
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

  it('wrapTool returns a coded upstream error when the inner handler throws', async () => {
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
    const body = {
      error: { code: 'UPSTREAM_UNKNOWN', message: 'boom' },
    };
    expect(result.structuredContent).toEqual(body);
    expect(
      JSON.parse((result.content as Array<{ type: string; text: string }>)[0]?.text ?? ''),
    ).toEqual(body);
  });

  it('wrapTool maps LightdashApiError 404 to UPSTREAM_NOT_FOUND', async () => {
    const contextProvider = {
      getContext: async () => ({
        lightdashClient: {},
        auth: { mode: 'none' as const },
      }),
    } as unknown as McpContextProvider;
    const wrapped = wrapTool(contextProvider, () => async () => {
      throw new LightdashApiError(
        404,
        { name: 'NotFound', statusCode: 404, message: 'chart missing' },
        {},
      );
    });

    const result = await wrapped({});

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: {
        code: 'UPSTREAM_NOT_FOUND',
        message: 'Lightdash API error: chart missing',
      },
    });
    expect(result).not.toHaveProperty('_lightdashBlocked');
  });
});
