/**
 * Input validation for agent-invoked CLI and MCP tools.
 * Guards against hallucinated or adversarial inputs (control chars, path injection, query params in IDs).
 *
 * @see https://justin.poehnelt.com/posts/rewrite-your-cli-for-ai-agents/
 */

import * as path from 'node:path';

const FORBIDDEN_IN_RESOURCE_ID = /[?#%]|\.\./;

/** RFC 4122 UUID (any version), case-insensitive hex. */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SLUG_REGEX = /^[A-Za-z0-9._-]+$/;

const SLUG_MIN_LENGTH = 1;
const SLUG_MAX_LENGTH = 256;

const FINGERPRINT_MIN_LENGTH = 1;
const FINGERPRINT_MAX_LENGTH = 512;

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
 * Validates a UUID string (RFC 4122 format).
 *
 * @param id - UUID to validate
 * @returns The input if valid
 * @throws Error if format is invalid or control characters are present
 */
export function validateUuid(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('UUID must be a string');
  }
  rejectControlChars(id);
  if (!UUID_REGEX.test(id)) {
    throw new Error('Invalid UUID format');
  }
  return id;
}

/**
 * Validates a slug: 1–256 chars, alphanumeric plus `.`, `_`, `-`.
 *
 * @param id - Slug to validate
 * @returns The input if valid
 * @throws Error if length or character set is invalid
 */
export function validateSlug(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('Slug must be a string');
  }
  rejectControlChars(id);
  if (id.length < SLUG_MIN_LENGTH || id.length > SLUG_MAX_LENGTH) {
    throw new Error(`Slug must be between ${SLUG_MIN_LENGTH} and ${SLUG_MAX_LENGTH} characters`);
  }
  if (!SLUG_REGEX.test(id)) {
    throw new Error(
      'Slug must contain only alphanumeric characters, dots, underscores, and hyphens',
    );
  }
  return id;
}

/**
 * Validates a fingerprint identifier: 1–512 chars, no control characters.
 *
 * @param id - Fingerprint to validate
 * @returns The input if valid
 * @throws Error if length is invalid or control characters are present
 */
export function validateFingerprint(id: string): string {
  if (typeof id !== 'string') {
    throw new Error('Fingerprint must be a string');
  }
  rejectControlChars(id);
  if (id.length < FINGERPRINT_MIN_LENGTH || id.length > FINGERPRINT_MAX_LENGTH) {
    throw new Error(
      `Fingerprint must be between ${FINGERPRINT_MIN_LENGTH} and ${FINGERPRINT_MAX_LENGTH} characters`,
    );
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
