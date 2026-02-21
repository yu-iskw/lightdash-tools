import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerToolSafe, READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE, WRITE_IDEMPOTENT } from './shared';
import { SafetyMode } from '@lightdash-tools/common';
import { setStaticSafetyMode, setStaticAllowedProjectUuids, setDryRunMode } from '../config.js';

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
    process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;
    delete process.env.LIGHTDASH_TOOLS_ALLOWED_PROJECTS;
    delete process.env.LIGHTDASH_DRY_RUN;
  });

  afterEach(() => {
    delete process.env.LIGHTDASH_TOOL_SAFETY_MODE;
  });

  it('should allow read-only tool in read-only mode', async () => {
    process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.READ_ONLY;
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
    process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.READ_ONLY;
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
    process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;
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
      const result = await handler({ projectUuid: 'any-uuid' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should allow calls for a singular projectUuid in the allowlist', async () => {
      setStaticAllowedProjectUuids(['uuid-allowed', 'uuid-other']);

      registerToolSafe(
        mockServer,
        'list_charts_allowed',
        { description: 'List charts', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: 'uuid-allowed' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should block calls for a singular projectUuid not in the allowlist', async () => {
      setStaticAllowedProjectUuids(['uuid-allowed']);

      registerToolSafe(
        mockServer,
        'list_charts_blocked',
        { description: 'List charts', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuid: 'uuid-denied' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not in the list of allowed projects');
      expect(result.content[0].text).toContain('uuid-denied');
    });

    it('should allow calls with no projectUuid arg even when allowlist is set', async () => {
      setStaticAllowedProjectUuids(['uuid-allowed']);

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
      setStaticAllowedProjectUuids(['uuid-a', 'uuid-b']);

      registerToolSafe(
        mockServer,
        'search_content_allowed',
        { description: 'Search content', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuids: ['uuid-a', 'uuid-b'] });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toBe('success');
    });

    it('should block when any UUID in projectUuids[] is not in the allowlist', async () => {
      setStaticAllowedProjectUuids(['uuid-a']);

      registerToolSafe(
        mockServer,
        'search_content_blocked',
        { description: 'Search content', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuids: ['uuid-a', 'uuid-denied'] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('uuid-denied');
      expect(result.content[0].text).toContain('not in the list of allowed projects');
    });

    it('should block when all projectUuids[] are outside the allowlist', async () => {
      setStaticAllowedProjectUuids(['uuid-allowed']);

      registerToolSafe(
        mockServer,
        'search_content_all_blocked',
        { description: 'Search content', inputSchema: {}, annotations: READ_ONLY_DEFAULT },
        mockHandler,
      );

      const [, , handler] = mockServer.registerTool.mock.calls[0];
      const result = await handler({ projectUuids: ['uuid-x', 'uuid-y'] });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not in the list of allowed projects');
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
      process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;

      registerToolSafe(
        mockServer,
        'upsert_thing_dry',
        { description: 'Upsert thing', inputSchema: {}, annotations: WRITE_IDEMPOTENT },
        mockHandler,
      );

      const [, options, handler] = mockServer.registerTool.mock.calls[0];
      expect(options.description).toContain('[DRY-RUN]');

      const result = await handler({ projectUuid: 'uuid-x', slug: 'my-chart' });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain('[DRY-RUN]');
      expect(result.content[0].text).toContain('No changes were made');
      // Verify the underlying handler was NOT called
      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should simulate destructive tools in dry-run mode', async () => {
      setDryRunMode(true);
      process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;

      registerToolSafe(
        mockServer,
        'delete_thing_dry',
        { description: 'Delete thing', inputSchema: {}, annotations: WRITE_DESTRUCTIVE },
        mockHandler,
      );

      const [, options, handler] = mockServer.registerTool.mock.calls[0];
      expect(options.description).toContain('[DRY-RUN]');

      const result = await handler({ projectUuid: 'uuid-x' });
      expect(result.content[0].text).toContain('No changes were made');
      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
});
