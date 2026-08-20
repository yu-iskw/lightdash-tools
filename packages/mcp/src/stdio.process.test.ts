/**
 * Process-level stdio smoke: spawn dist/bin.js, initialize, tools/list.
 * Exercises the real MCP SDK transport — no SDK mocks. Avoids Lightdash network calls.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';

import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it } from 'vitest';

import { getProfile } from './profiles/index.js';
import { TOOL_PREFIX } from './tools/shared.js';

/** Vitest runs from the monorepo root (`vitest.config.ts`). */
const repoRoot = process.cwd();
const binPath = path.join(repoRoot, 'packages/mcp/dist/bin.js');

const INIT_TIMEOUT_MS = 5_000;
const SEMANTIC_LAYER_TOOL_COUNT = getProfile('semantic-layer').tools.length;

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
  getStderr: () => string,
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
      const stderr = getStderr().trim();
      const suffix = stderr ? `\nstderr:\n${stderr}` : '';
      reject(
        new Error(
          `MCP process exited early (code=${code}) before response id=${expectedId}${suffix}`,
        ),
      );
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

function stdioSmokeEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    LIGHTDASH_URL: 'https://app.lightdash.cloud',
    LIGHTDASH_API_KEY: 'dummy-key-for-stdio-smoke',
    LIGHTDASH_TOOLS_AUDIT_LOG: undefined,
    ...overrides,
  };
}

function spawnStdioBin(
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {},
): { child: ChildProcessWithoutNullStreams; getStderr: () => string } {
  let stderr = '';
  const child = spawn(process.execPath, [binPath, ...args], {
    cwd: repoRoot,
    env: stdioSmokeEnv(envOverrides),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });
  return { child, getStderr: () => stderr };
}

async function spawnBinAndAwaitExit(
  args: string[],
  envOverrides: NodeJS.ProcessEnv = {},
): Promise<{ code: number | null; stderr: string; stdout: string }> {
  let stdout = '';
  const { child, getStderr } = spawnStdioBin(args, envOverrides);
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk;
  });
  const code = await new Promise<number | null>((resolve) => {
    child.once('exit', (exitCode) => resolve(exitCode));
  });
  return { code, stderr: getStderr(), stdout };
}

/** Legacy initialize → notifications/initialized → tools/list over stdio. */
async function initializeThenListTools(
  child: ChildProcessWithoutNullStreams,
  getStderr: () => string,
  clientName: string,
): Promise<{ serverName: string | undefined; tools: Array<{ name: string }> }> {
  writeLine(child, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: clientName, version: '0.0.0' },
    },
  });

  const initResponse = await readJsonRpcResponse(child, 1, INIT_TIMEOUT_MS, getStderr);
  expect(initResponse.error).toBeUndefined();
  expect(initResponse.result).toBeDefined();
  const initResult = initResponse.result as {
    serverInfo?: { name?: string };
    protocolVersion?: string;
  };
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

  const listResponse = await readJsonRpcResponse(child, 2, INIT_TIMEOUT_MS, getStderr);
  expect(listResponse.error).toBeUndefined();
  const tools = (listResponse.result as { tools?: Array<{ name: string }> }).tools;
  expect(Array.isArray(tools)).toBe(true);
  return { serverName: initResult.serverInfo?.name, tools: tools ?? [] };
}

describe('stdio process smoke', () => {
  let child: ChildProcessWithoutNullStreams | undefined;

  afterEach(() => {
    killChild(child);
    child = undefined;
  });

  it('server/discover then tools/list over stdio (modern era)', async () => {
    const spawned = spawnStdioBin(['stdio', '--profile', 'semantic-layer']);
    child = spawned.child;
    const getStderr = spawned.getStderr;

    const modernMeta = {
      [PROTOCOL_VERSION_META_KEY]: '2026-07-28',
      [CLIENT_INFO_META_KEY]: {
        name: 'stdio-process-smoke-modern',
        version: '0.0.0',
      },
      [CLIENT_CAPABILITIES_META_KEY]: {},
    };

    writeLine(child, {
      jsonrpc: '2.0',
      id: 1,
      method: 'server/discover',
      params: { _meta: modernMeta },
    });

    const discoverResponse = await readJsonRpcResponse(child, 1, INIT_TIMEOUT_MS, getStderr);
    expect(discoverResponse.error).toBeUndefined();
    expect(discoverResponse.result).toBeDefined();
    const discoverResult = discoverResponse.result as {
      supportedVersions?: string[];
      capabilities?: { tools?: unknown };
    };
    expect(discoverResult.supportedVersions).toContain('2026-07-28');
    expect(discoverResult.capabilities?.tools).toBeDefined();

    writeLine(child, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: { _meta: modernMeta },
    });

    const listResponse = await readJsonRpcResponse(child, 2, INIT_TIMEOUT_MS, getStderr);
    expect(listResponse.error).toBeUndefined();
    expect(listResponse.result).toMatchObject({
      tools: expect.arrayContaining([
        expect.objectContaining({ name: `${TOOL_PREFIX}list_projects` }),
      ]),
    });
    const listResult = listResponse.result as { tools: unknown[] };
    expect(listResult.tools).toHaveLength(SEMANTIC_LAYER_TOOL_COUNT);

    killChild(child);
    child = undefined;
  });

  it('initialize then tools/list over stdio', async () => {
    const spawned = spawnStdioBin(['stdio', '--profile', 'semantic-layer']);
    child = spawned.child;
    const { serverName, tools } = await initializeThenListTools(
      child,
      spawned.getStderr,
      'stdio-process-smoke',
    );
    expect(serverName).toBe('lightdash-mcp-semantic-layer');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === 'lightdash_list_projects')).toBe(true);

    killChild(child);
    child = undefined;
  });

  it('initialize then tools/list for content-reader profile', async () => {
    const spawned = spawnStdioBin(['stdio', '--profile', 'content-reader']);
    child = spawned.child;
    const { serverName, tools } = await initializeThenListTools(
      child,
      spawned.getStderr,
      'stdio-process-smoke',
    );
    expect(serverName).toBe('lightdash-mcp-content');
    expect(tools).toHaveLength(14);
    expect(tools.some((t) => t.name === 'lightdash_search_content')).toBe(true);
    expect(tools.some((t) => t.name === 'lightdash_list_verified_content')).toBe(true);
    expect(tools.some((t) => t.name === 'lightdash_run_chart')).toBe(true);
    expect(tools.some((t) => t.name === 'lightdash_export_chart_image')).toBe(false);

    killChild(child);
    child = undefined;
  });

  it('initialize then tools/list for content-governance profile', async () => {
    const spawned = spawnStdioBin(['stdio', '--profile', 'content-governance']);
    child = spawned.child;
    const { serverName, tools } = await initializeThenListTools(
      child,
      spawned.getStderr,
      'stdio-process-smoke',
    );
    expect(serverName).toBe('lightdash-mcp-gov');
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => t.name).sort()).toEqual([
      'lightdash_delete_chart',
      'lightdash_delete_dashboard',
      'lightdash_get_dashboard_promote_diff',
      'lightdash_promote_dashboard',
    ]);

    killChild(child);
    child = undefined;
  });

  it('initialize then tools/list for content-developer profile', async () => {
    const spawned = spawnStdioBin(['stdio', '--profile', 'content-developer']);
    child = spawned.child;
    const { serverName, tools } = await initializeThenListTools(
      child,
      spawned.getStderr,
      'stdio-process-smoke',
    );
    expect(serverName).toBe('lightdash-mcp-cdev');
    expect(tools).toHaveLength(26);
    expect(tools.some((t) => t.name === 'lightdash_get_chart_as_code')).toBe(true);
    expect(tools.some((t) => t.name === 'lightdash_preview_dashboard_changes')).toBe(true);
    expect(tools.some((t) => t.name === 'lightdash_move_content')).toBe(true);

    killChild(child);
    child = undefined;
  });

  it('bare invoke exits nonzero without a transport', async () => {
    const result = await spawnBinAndAwaitExit([]);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/stdio --profile/i);
    expect(result.stdout).toBe('');
  });

  it('stdio without --profile exits nonzero', async () => {
    const result = await spawnBinAndAwaitExit(['stdio']);
    expect(result.code).not.toBe(0);
    expect(result.stderr).toMatch(/required option|--profile|usage:/i);
  });

  it('stdio with invalid --profile exits nonzero', async () => {
    const result = await spawnBinAndAwaitExit(['stdio', '--profile', 'not-a-profile']);
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/Invalid profile/i);
    expect(result.stdout).toBe('');
  });
});
