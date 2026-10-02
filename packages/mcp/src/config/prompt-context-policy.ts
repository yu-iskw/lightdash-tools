/**
 * Prompt-context policy for progressive-disclosure playbook embedding (RFC).
 *
 * Canonical: `LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT`.
 * CLI `--prompt-context` overrides env. Unset → package default (`compact`).
 * Invalid values fail closed.
 */

import { ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT } from './env.js';
import { readEnv } from './read-env.js';

export const PROMPT_CONTEXT_POLICIES = ['compact', 'compatible', 'embedded'] as const;

export type PromptContextPolicy = (typeof PROMPT_CONTEXT_POLICIES)[number];

/** Package default after progressive-disclosure migration. */
export const DEFAULT_PROMPT_CONTEXT_POLICY: PromptContextPolicy = 'compact';

export function isPromptContextPolicy(value: string): value is PromptContextPolicy {
  return (PROMPT_CONTEXT_POLICIES as readonly string[]).includes(value);
}

export function parsePromptContextPolicy(raw: string | undefined): PromptContextPolicy {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_PROMPT_CONTEXT_POLICY;
  }
  const value = raw.trim();
  if (!isPromptContextPolicy(value)) {
    throw new Error(
      `${ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT} must be one of: ${PROMPT_CONTEXT_POLICIES.join(', ')} (got '${value}')`,
    );
  }
  return value;
}

/** CLI flag wins when present (non-empty). */
export function resolvePromptContextPolicy(opts: {
  cli?: string;
  env?: NodeJS.ProcessEnv;
}): PromptContextPolicy {
  const fromCli = opts.cli?.trim();
  if (fromCli) {
    return parsePromptContextPolicy(fromCli);
  }
  return parsePromptContextPolicy(
    readEnv(ENV_LIGHTDASH_TOOLS_MCP_PROMPT_CONTEXT, opts.env ?? process.env),
  );
}
