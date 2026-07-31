/**
 * Process-level stdio smoke: spawn dist/bin.js, initialize, tools/list.
 * Exercises the real MCP SDK transport — no SDK mocks. Avoids Lightdash network calls.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

/** Vitest runs from the monorepo root (`vitest.config.ts`). */
const repoRoot = process.cwd();
const binPath = path.join(repoRoot, 'packages/mcp/dist/bin.js');

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

describe('stdio process smoke', () => {
  let child: ChildProcessWithoutNullStreams | undefined;

  afterEach(() => {
    killChild(child);
    child = undefined;
  });

  it('initialize then tools/list over stdio', async () => {
    child = spawn(process.execPath, [binPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        LIGHTDASH_URL: 'https://app.lightdash.cloud',
        LIGHTDASH_API_KEY: 'dummy-key-for-stdio-smoke',
        // Avoid inheriting real credentials or network-affecting settings.
        LIGHTDASH_TOOLS_AUDIT_LOG: undefined,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Drain stderr so the child cannot block on a full pipe.
    child.stderr.resume();

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
    };
    expect(initResult.serverInfo?.name).toBe('lightdash-mcp-semantic-layer');
    expect(initResult.protocolVersion).toBeTruthy();

    writeLine(child, {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });

    writeLine(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const listResponse = await readJsonRpcResponse(child, 2, INIT_TIMEOUT_MS);
    expect(listResponse.error).toBeUndefined();
    const listResult = listResponse.result as { tools?: Array<{ name: string }> };
    expect(Array.isArray(listResult.tools)).toBe(true);
    expect(listResult.tools!.length).toBeGreaterThan(0);
    expect(listResult.tools!.some((t) => t.name === 'ldt__list_projects')).toBe(true);

    killChild(child);
    child = undefined;
  });
});
