/**
 * Read and parse JSON or YAML from --file or stdin.
 */

import { readFileSync } from 'node:fs';

import { parse as parseYaml } from 'yaml';

export type FileInputOptions = {
  file?: string;
  stdin?: boolean;
};

/**
 * True when the caller explicitly requested file or stdin input (--file / --stdin).
 * Unlike {@link readFileOrStdin}, does not treat a non-TTY stdin as implicit input,
 * so flag-only commands work in CI where stdin is closed.
 */
export function hasExplicitFileInput(options: FileInputOptions): boolean {
  return options.file != null || options.stdin === true;
}

/**
 * Reads YAML/JSON only when --file or --stdin was explicitly requested.
 * Use for commands that also support flag-based bodies in non-TTY environments.
 */
export async function readExplicitFileOrStdin(options: FileInputOptions): Promise<string> {
  if (!hasExplicitFileInput(options)) {
    throw new Error('No input provided. Use --file <path> or --stdin.');
  }
  return readFileOrStdin(options);
}

/**
 * Reads raw text from a file path or stdin (when --stdin is set or stdin is piped).
 */
export async function readFileOrStdin(options: FileInputOptions): Promise<string> {
  if (options.file) {
    return readFileSync(options.file, 'utf-8');
  }
  if (options.stdin === true || !process.stdin.isTTY) {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      process.stdin.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'));
      });
      process.stdin.on('error', reject);
    });
  }
  throw new Error('No input provided. Use --file <path> or --stdin to read from stdin.');
}

/**
 * Parses a string as JSON (object/array) or YAML.
 */
export function parseJsonOrYaml(content: string): unknown {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    throw new Error('Input is empty');
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as unknown;
  }
  return parseYaml(content) as unknown;
}

/**
 * Reads from file or stdin and parses as JSON or YAML.
 */
export async function readParsedInput(options: FileInputOptions): Promise<unknown> {
  const content = await readFileOrStdin(options);
  try {
    return parseJsonOrYaml(content);
  } catch (error) {
    throw new Error(
      `Failed to parse input as JSON or YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
