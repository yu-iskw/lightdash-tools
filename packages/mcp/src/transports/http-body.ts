import { sendJson } from './http-response.js';

import type { IncomingMessage, ServerResponse } from 'node:http';

export function readBody(
  req: IncomingMessage,
  res: ServerResponse,
  maxBodyBytes: number,
): Promise<Buffer | undefined> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > maxBodyBytes) {
        rejected = true;
        req.destroy();
        sendJson(res, 413, { error: 'Payload Too Large' });
        resolve(undefined);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!rejected) resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

export function parseJsonBody(buffer: Buffer): unknown {
  const text = buffer.toString('utf-8');
  if (!text.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new SyntaxError('Invalid JSON body');
  }
}
