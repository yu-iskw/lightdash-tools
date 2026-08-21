/**
 * MCP prompts for ai-agent-chat workflows (progressive-disclosure context).
 *
 * Procedure detail lives in playbooks (manifest / selective embed via policy).
 * Prompt bodies stay goal/input-specific — do not restate entire SOPs here.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches other profile prompt registration pattern */
import { z } from 'zod';

import {
  formatPromptProjectUuidLine,
  optionalProjectUuidField,
} from '../../../tools/lib/schema-fields.js';
import { bindProfilePromptContext } from '../../lib/prompt-context.js';

import { AI_AGENT_CHAT_DEFAULT_INVARIANT_IDS, AI_AGENT_CHAT_INVARIANTS } from './invariants.js';
import {
  AI_AGENT_CHAT_CORE_PLAYBOOK,
  AI_AGENT_CHAT_TOPIC_META,
  AI_AGENT_CHAT_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { AiAgentChatPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const TOPIC_CONVERSATION = 'conversation' as const satisfies AiAgentChatPlaybookTopic;

const bindPromptContext = bindProfilePromptContext({
  invariants: AI_AGENT_CHAT_INVARIANTS,
  core: AI_AGENT_CHAT_CORE_PLAYBOOK,
  topics: AI_AGENT_CHAT_TOPIC_PLAYBOOKS,
  topicMeta: AI_AGENT_CHAT_TOPIC_META,
});

export function registerAiAgentChatPrompts(
  server: McpServer,
  options?: RegisterPromptsOptions,
): void {
  const promptContext = bindPromptContext(options?.promptContextPolicy);
  const invariantIds = AI_AGENT_CHAT_DEFAULT_INVARIANT_IDS;

  server.registerPrompt(
    'ask_lightdash_ai_agent',
    {
      title: 'Ask Lightdash AI Agent',
      description:
        'Start a new managed Lightdash AI Agent conversation as the current user — do not substitute data-analyst',
      argsSchema: {
        projectUuid: optionalProjectUuidField(),
        question: z.string(),
        agentHint: z.string().optional(),
      },
    },
    ({ projectUuid, question, agentHint }) =>
      promptContext({
        task: `Start a **new** managed Lightdash AI Agent conversation (not a host-side Explore rewrite):

${question}

${formatPromptProjectUuidLine(projectUuid)}
Agent hint: ${agentHint ?? '(use get_user_agent_preferences, else list_project_agents)'}.

Always create a new thread (preferences/list → create_agent_thread with the exact question as prompt → generate_agent_response). Do not call create_agent_thread_message on the first turn. Do not list or resume threads for a plain question. On generate failure, report the upstream error — do not silently switch to data-analyst or semantic-layer.`,
        invariantIds,
        requiredTopics: [TOPIC_CONVERSATION],
      }),
  );

  server.registerPrompt(
    'continue_lightdash_ai_agent',
    {
      title: 'Continue Lightdash AI Agent thread',
      description:
        "Add a follow-up on a known own-thread UUID and generate — do not auto-browse or take over other users' threads",
      argsSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: z.string().optional(),
        threadUuid: z.string().optional(),
        question: z.string(),
      },
    },
    ({ projectUuid, agentUuid, threadUuid, question }) =>
      promptContext({
        task: `Continue a managed Lightdash AI Agent conversation on a **known** own-thread UUID.

${formatPromptProjectUuidLine(projectUuid)}
Agent: ${agentUuid ?? '(from current context)'}.
Thread: ${threadUuid ?? '(reuse known threadUuid from this session; if missing ask the user or start a new ask — do not default to list_agent_threads)'}.
Follow-up: ${question}

Use create_agent_thread_message then generate_agent_response. Do not create a second message when retrying generate. List caller-visible threads only if the user explicitly asks to find their own prior chat.`,
        invariantIds,
        requiredTopics: [TOPIC_CONVERSATION],
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
