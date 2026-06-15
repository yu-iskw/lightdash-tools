/**
 * MCP completion registration for Lightdash capability profiles.
 */

import {
  createAgentUuidCompleter,
  createEvalUuidCompleter,
  createProjectUuidCompleter,
  createRunUuidCompleter,
} from './ai-agents.js';

import type { McpContextProvider } from '../request-context.js';

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
  contextProvider: McpContextProvider,
): AiAgentCompletionCallbacks {
  return {
    projectUuid: createProjectUuidCompleter(contextProvider),
    agentUuid: createAgentUuidCompleter(contextProvider),
    evalUuid: createEvalUuidCompleter(contextProvider),
    runUuid: createRunUuidCompleter(contextProvider),
  };
}
