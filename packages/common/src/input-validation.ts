/**
 * Input validation for agent-invoked CLI and MCP tools.
 * Guards against hallucinated or adversarial inputs (control chars, path injection, query params in IDs).
 *
 * @see https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/
 */

import * as path from 'node:path';

const FORBIDDEN_IN_RESOURCE_ID = /[?#%]|\.\./;

function hasControlChars(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Rejects strings containing ASCII control characters (code < 0x20).
 * Agents may generate invisible characters; humans rarely do.
 *
 * @param str - User-provided string to validate
 * @returns The input string if valid
 * @throws Error if control characters are present
 */
export function rejectControlChars(str: string): string {
  if (str === '') return str;
  if (hasControlChars(str)) {
    throw new Error('Input contains invalid control characters');
  }
  return str;
}

/**
 * Validates a resource ID (projectUuid, slug, etc.) to prevent path/query injection.
 * Rejects: ?, #, %, .., and control characters.
 * Accepts: valid UUIDs and safe slugs (alphanumeric, hyphen, underscore).
 *
 * @param id - Resource ID to validate
 * @returns The input if valid
 * @throws Error if forbidden characters are present
 */
export function validateResourceId(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('Resource ID must be a string');
  }
  rejectControlChars(id);
  if (FORBIDDEN_IN_RESOURCE_ID.test(id)) {
    throw new Error('Resource ID must not contain ?, #, %, or path traversal (..)');
  }
  return id;
}

/**
 * Validates that a file path is safe for output within the current working directory.
 * Rejects: .. traversal, absolute paths outside CWD.
 *
 * @param filePath - Path to validate (relative or absolute)
 * @returns Resolved absolute path within CWD
 * @throws Error if path escapes CWD
 */
export function validateSafeOutputDir(filePath: string): string {
  const cwd = process.cwd();
  const resolved = path.resolve(cwd, filePath);
  const cwdNormalized = path.resolve(cwd);
  if (resolved !== cwdNormalized && !resolved.startsWith(cwdNormalized + path.sep)) {
    throw new Error(`Path must be within current working directory: ${cwd}`);
  }
  return resolved;
}
