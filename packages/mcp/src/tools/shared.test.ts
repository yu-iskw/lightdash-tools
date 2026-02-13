import { describe, it, expect, vi } from 'vitest';
import { registerToolSafe, READ_ONLY_DEFAULT, WRITE_DESTRUCTIVE } from './shared';
import { SafetyMode } from '@lightdash-tools/common';

describe('registerToolSafe', () => {
  const mockServer = {
    registerTool: vi.fn(),
  };

  const mockHandler = vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'success' }] });

  it('should allow read-only tool in read-only mode', async () => {
    process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.READ_ONLY;

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

    const [, options, handler] = mockServer.registerTool.mock.calls[1];

    expect(options.description).toContain('[DISABLED in read-only mode]');

    const result = await handler({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('disabled in read-only mode');
  });

  it('should allow destructive tool in write-destructive mode', async () => {
    process.env.LIGHTDASH_TOOL_SAFETY_MODE = SafetyMode.WRITE_DESTRUCTIVE;

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

    const [, options, handler] = mockServer.registerTool.mock.calls[2];

    expect(options.description).toBe('Delete something 2');

    const result = await handler({});
    expect(result.content[0].text).toBe('success');
  });
});
