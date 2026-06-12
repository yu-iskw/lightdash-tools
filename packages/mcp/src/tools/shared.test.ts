import { SafetyMode } from '@lightdash-tools/common';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { setStaticSafetyMode, setStaticAllowedProjectUuids, setDryRunMode } from '../config.js';

import {
  registerToolSafe,
  wrapTool,
  READ_ONLY_DEFAULT,
  WRITE_DESTRUCTIVE,
  WRITE_IDEMPOTENT,
} from './shared';

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
const PROJECT_ALLOWED = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PROJECT_OTHER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PROJECT_DENIED = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const PROJECT_X = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PROJECT_Y = '11111111-1111-4111-8111-111111111111';

describe('registerToolSafe', () => {
  const mockServer = {
    registerTool: vi.fn(),
  };

  const mockHandler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'success' }] });

  beforeEach(() => {
    mockServer.registerTool.mockClear();
    mockHandler.mockClear();
    // Reset globals to safe defaults
    setStaticSafetyMode(SafetyMode.WRITE_DESTRUCTIVE);
    setStaticAllowedProjectUuids([]);
    setDryRunMode(false);
    process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;
    delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    delete process.env.LIGHTDASH_TOOLS_DRY_RUN;
  });

  afterEach(() => {
    delete process.env.LIGHTDASH_TOOLS_SAFETY_MODE;
  });

  it('should allow read-only tool in read-only mode', async () => {
    process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.READ_ONLY;
    setStaticSafetyMode(SafetyMode.WRITE_DESTRUCTIVE); // static = allow all

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

  it('should block destructive tool in read-only mode', async () => {
    process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.READ_ONLY;
    setStaticSafetyMode(SafetyMode.WRITE_DESTRUCTIVE);

    registerToolSafe(
      mockServer,
      'delete_tool',
      {
        description: 'Delete something',
        inputSchema: {},
        annotations: WRITE_DESTRUCTIVE,
      },
      mockHandler,
    );

    const [, options, handler] = mockServer.registerTool.mock.calls[0];

    expect(options.description).toContain('[DISABLED in read-only mode]');

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('disabled in read-only mode');
  });

  it('should allow destructive tool in write-destructive mode', async () => {
    process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;
    setStaticSafetyMode(SafetyMode.WRITE_DESTRUCTIVE);

    registerToolSafe(
      mockServer,
      'delete_tool_2',
      {
        description: 'Delete something 2',
        inputSchema: {},
        annotations: WRITE_DESTRUCTIVE,
      },
      mockHandler,
    );

    const [, options, handler] = mockServer.registerTool.mock.calls[0];

    expect(options.description).toBe('Delete something 2');

    const result = await handler({});
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

  describe('static filtering (safety-mode)', () => {
    it('should skip registration if tool is more permissive than binded mode', () => {
      setStaticSafetyMode(SafetyMode.READ_ONLY);
      mockServer.registerTool.mockClear();

      registerToolSafe(
        mockServer,
        'destructive_tool_static',
        {
          description: 'Destructive',
          inputSchema: {},
          annotations: WRITE_DESTRUCTIVE,
        },
        mockHandler,
      );

      expect(mockServer.registerTool).not.toHaveBeenCalled();
    });

    it('should allow registration if tool matches binded mode', () => {
      setStaticSafetyMode(SafetyMode.READ_ONLY);
      mockServer.registerTool.mockClear();

      registerToolSafe(
        mockServer,
        'readonly_tool_static',
        {
          description: 'Read-only',
          inputSchema: {},
          annotations: READ_ONLY_DEFAULT,
        },
        mockHandler,
      );

      expect(mockServer.registerTool).toHaveBeenCalled();
    });

    it('should allow everything if binded mode is write-destructive', () => {
      setStaticSafetyMode(SafetyMode.WRITE_DESTRUCTIVE);
      mockServer.registerTool.mockClear();

      registerToolSafe(
        mockServer,
        'any_tool_static',
        {
          description: 'Any',
          inputSchema: {},
          annotations: WRITE_DESTRUCTIVE,
        },
        mockHandler,
      );

      expect(mockServer.registerTool).toHaveBeenCalled();
    });
  });

  describe('project UUID allowlist', () => {
    it('should allow calls when allowlist is empty (all projects permitted)', async () => {
      setStaticAllowedProjectUuids([]);

      registerToolSafe(
        mockServer,
        'list_charts',
        { description: 'List charts', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: PROJECT_A });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should allow calls for a singular projectUuid in the allowlist', async () => {
      setStaticAllowedProjectUuids([PROJECT_ALLOWED, PROJECT_OTHER]);

      registerToolSafe(
        mockServer,
        'list_charts_allowed',
        { description: 'List charts', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: PROJECT_ALLOWED });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should block calls for a singular projectUuid not in the allowlist', async () => {
      setStaticAllowedProjectUuids([PROJECT_ALLOWED]);

      registerToolSafe(
        mockServer,
        'list_charts_blocked',
        { description: 'List charts', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: PROJECT_DENIED });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not in the list of allowed projects');
      expect(result.content[0].text).toContain(PROJECT_DENIED);
    });

    it('should allow calls with no projectUuid arg even when allowlist is set', async () => {
      setStaticAllowedProjectUuids([PROJECT_ALLOWED]);

      registerToolSafe(
        mockServer,
        'list_projects_no_uuid',
        { description: 'List projects', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      // No projectUuid in args → allowlist does not apply
      const result = await handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should allow when all projectUuids[] are in the allowlist', async () => {
      setStaticAllowedProjectUuids([PROJECT_A, PROJECT_B]);

      registerToolSafe(
        mockServer,
        'search_content_allowed',
        { description: 'Search content', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuids: [PROJECT_A, PROJECT_B] });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should block when any UUID in projectUuids[] is not in the allowlist', async () => {
      setStaticAllowedProjectUuids([PROJECT_A]);

      registerToolSafe(
        mockServer,
        'search_content_blocked',
        { description: 'Search content', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuids: [PROJECT_A, PROJECT_DENIED] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(PROJECT_DENIED);
      expect(result.content[0].text).toContain('not in the list of allowed projects');
    });

    it('should block when all projectUuids[] are outside the allowlist', async () => {
      setStaticAllowedProjectUuids([PROJECT_ALLOWED]);

      registerToolSafe(
        mockServer,
        'search_content_all_blocked',
        { description: 'Search content', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuids: [PROJECT_X, PROJECT_Y] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not in the list of allowed projects');
    });

    it('should block invalid bundleYaml when allowlist is set and project cannot be extracted', async () => {
      setStaticAllowedProjectUuids([PROJECT_ALLOWED]);

      registerToolSafe(
        mockServer,
        'agentops_plan_blocked_yaml',
        { description: 'Plan bundle', inputSchema: {}, annotations: WRITE_IDEMPOTENT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ bundleYaml: 'not: valid: yaml: document' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Could not extract project UUID from YAML');
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should enforce allowlist for valid bundleYaml projectUuid', async () => {
      setStaticAllowedProjectUuids([PROJECT_ALLOWED]);

      registerToolSafe(
        mockServer,
        'agentops_plan_allowed_yaml',
        { description: 'Plan bundle', inputSchema: {}, annotations: WRITE_IDEMPOTENT },
        mockHandler,
      );

      const bundleYaml = [
        'apiVersion: lightdash.ai/v1alpha1',
        'kind: LightdashAiAgentBundle',
        'metadata:',
        '  name: test-bundle',
        'spec:',
        `  projectUuid: ${PROJECT_DENIED}`,
        '  agents:',
        '    - key: a1',
        '      name: Agent One',
        '      evaluations: []',
      ].join('\n');

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ bundleYaml });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain(PROJECT_DENIED);
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('dry-run mode', () => {
    it('should not affect read-only tools in dry-run mode', async () => {
      setDryRunMode(true);

      registerToolSafe(
        mockServer,
        'list_things_dry',
        { description: 'List things', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, options, handler] = mockServer.registerTool.mock.calls[0];
      expect(options.description).not.toContain('[DRY-RUN]');

      const result = await handler({});
      expect(result.content[0].text).toBe('success');
    });

    it('should simulate write-idempotent tools in dry-run mode', async () => {
      setDryRunMode(true);
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;

      registerToolSafe(
        mockServer,
        'upsert_thing_dry',
        { description: 'Upsert thing', inputSchema: {}, annotations: WRITE_IDEMPOTENT },
        mockHandler,
      );

      const [, options, handler] = mockServer.registerTool.mock.calls[0];
      expect(options.description).toContain('[DRY-RUN]');

      const result = await handler({ projectUuid: PROJECT_X, slug: 'my-chart' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('[DRY-RUN]');
      expect(result.content[0].text).toContain('No changes were made');
      // Verify the underlying handler was NOT called
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should simulate destructive tools in dry-run mode', async () => {
      setDryRunMode(true);
      process.env.LIGHTDASH_TOOLS_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;

      registerToolSafe(
        mockServer,
        'delete_thing_dry',
        { description: 'Delete thing', inputSchema: {}, annotations: WRITE_DESTRUCTIVE },
        mockHandler,
      );

      const [, options, handler] = mockServer.registerTool.mock.calls[0];
      expect(options.description).toContain('[DRY-RUN]');

      const result = await handler({ projectUuid: PROJECT_X });
      expect(result.content[0].text).toContain('No changes were made');
      expect(mockHandler).not.toHaveBeenCalled();
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
    expect(result.content[0].text).toContain('Invalid slug');
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
    const wrapped = wrapTool({} as never, () => async () => {
      throw new Error('boom');
    });

    const result = await wrapped({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('boom');
  });
});
