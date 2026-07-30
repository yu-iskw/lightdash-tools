/**
 * Process-level stdio smoke: spawn dist/bin.js, initialize, prompts/list, resources/list.
 * Exercises the real MCP SDK v2 transport (compatibility-first: connect + StdioServerTransport).
 * Avoids Lightdash network calls.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

/** Vitest runs from the monorepo root (`vitest.config.ts`). */
const repoRoot = process.cwd();
const binPath = path.join(repoRoot, 'packages/semantic-layer-mcp/dist/bin.js');

const INIT_TIMEOUT_MS = 5_000;

interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string;
  method?: string;
  result?: unknown;
  error?: { code: number; message: string };
}

function writeLine(child: ChildProcessWithoutNullStreams, message: unknown): void {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

async function readJsonRpcResponse(
  child: ChildProcessWithoutNullStreams,
  expectedId: number,
  timeoutMs: number,
): Promise<JsonRpcMessage> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for JSON-RPC response id=${expectedId}`));
    }, timeoutMs);

    const onData = (chunk: Buffer): void => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('{')) continue;
        let msg: JsonRpcMessage;
        try {
          msg = JSON.parse(trimmed) as JsonRpcMessage;
        } catch {
          continue;
        }
        if (msg.id === expectedId) {
          cleanup();
          resolve(msg);
          return;
        }
      }
    };

    const onExit = (code: number | null): void => {
      cleanup();
      reject(new Error(`MCP process exited early (code=${code}) before response id=${expectedId}`));
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.off('exit', onExit);
    };

    child.stdout.on('data', onData);
    child.once('exit', onExit);
  });
}

function killChild(child: ChildProcessWithoutNullStreams | undefined): void {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
}

describe('stdio process smoke (SDK v2, host-compatible)', () => {
  let child: ChildProcessWithoutNullStreams | undefined;

  afterEach(() => {
    killChild(child);
    child = undefined;
  });

  it('initialize then prompts/list and resources/list over stdio', async () => {
    child = spawn(process.execPath, [binPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_API_KEY: 'dummy-key-for-stdio-smoke',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stderr.resume();

    // Protocol version used by current Claude Code / Cursor-era hosts in this repo's smoke tests.
    writeLine(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'stdio-process-smoke', version: '0.0.0' },
      },
    });

    const initResponse = await readJsonRpcResponse(child, 1, INIT_TIMEOUT_MS);
    expect(initResponse.error).toBeUndefined();
    expect(initResponse.result).toBeDefined();
    const initResult = initResponse.result as {
      serverInfo?: { name?: string };
      protocolVersion?: string;
      capabilities?: { prompts?: unknown; resources?: unknown };
    };
    expect(initResult.serverInfo?.name).toBe('lightdash-semantic-layer-mcp');
    expect(initResult.protocolVersion).toBeTruthy();
    expect(initResult.capabilities?.prompts).toBeDefined();
    expect(initResult.capabilities?.resources).toBeDefined();

    writeLine(child, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    writeLine(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'prompts/list',
      params: {},
    });

    const promptsResponse = await readJsonRpcResponse(child, 2, INIT_TIMEOUT_MS);
    expect(promptsResponse.error).toBeUndefined();
    const promptsResult = promptsResponse.result as { prompts?: Array<{ name: string }> };
    expect(Array.isArray(promptsResult.prompts)).toBe(true);
    const promptNames = (promptsResult.prompts ?? []).map((p) => p.name);
    expect(promptNames).toEqual(
      expect.arrayContaining([
        'lightdash_semantic_explore',
        'lightdash_semantic_compose_compile',
        'lightdash_semantic_compile_debug',
      ]),
    );
    expect(promptNames).toHaveLength(3);

    writeLine(child, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
      params: {},
    });

    const resourcesResponse = await readJsonRpcResponse(child, 3, INIT_TIMEOUT_MS);
    expect(resourcesResponse.error).toBeUndefined();
    const resourcesResult = resourcesResponse.result as {
      resources?: Array<{ uri: string; name?: string }>;
    };
    expect(Array.isArray(resourcesResult.resources)).toBe(true);
    expect(
      resourcesResult.resources!.some((r) => r.uri === 'lightdash://playbooks/semantic-layer'),
    ).toBe(true);

    killChild(child);
    child = undefined;
  });
});
