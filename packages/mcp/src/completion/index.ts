/**
 * MCP completion registration for Lightdash capability profiles.
 */

import {
  createAgentUuidCompleter,
  createEvalUuidCompleter,
  createProjectUuidCompleter,
  createRunUuidCompleter,
} from './ai-agents.js';

import type { LightdashClient } from '@lightdash-tools/client';

export {
  createAgentUuidCompleter,
  createEvalUuidCompleter,
  createProjectUuidCompleter,
  createRunUuidCompleter,
} from './ai-agents.js';

/** Completion callbacks keyed by template variable name (for resource templates). */
export type AiAgentCompletionCallbacks = {
  projectUuid: (
    value: string,
    context?: { arguments?: Record<string, string> },
  ) => Promise<string[]>;
  agentUuid: (value: string, context?: { arguments?: Record<string, string> }) => Promise<string[]>;
  evalUuid: (value: string, context?: { arguments?: Record<string, string> }) => Promise<string[]>;
  runUuid: (value: string, context?: { arguments?: Record<string, string> }) => Promise<string[]>;
};

/** Builds AI agent completion callbacks for resources and prompts. */
export function createAiAgentCompletionCallbacks(
  client: LightdashClient,
): AiAgentCompletionCallbacks {
  return {
    projectUuid: createProjectUuidCompleter(client),
    agentUuid: createAgentUuidCompleter(client),
    evalUuid: createEvalUuidCompleter(client),
    runUuid: createRunUuidCompleter(client),
  };
}
