/**
 * MCP prompts for ai-agent-chat workflows (progressive-disclosure context).
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
        'Ask or continue a managed Lightdash AI Agent conversation as the current user — do not substitute data-analyst',
      argsSchema: {
        projectUuid: optionalProjectUuidField(),
        question: z.string(),
        agentHint: z.string().optional(),
      },
    },
    ({ projectUuid, question, agentHint }) =>
      promptContext({
        task: `Delegate this question to the managed Lightdash AI Agent (not a host-side Explore rewrite):

${question}

${formatPromptProjectUuidLine(projectUuid)}
Agent hint: ${agentHint ?? '(use get_user_agent_preferences, else list_project_agents)'}.

Procedure:
1. Resolve project scope.
2. If the user named an agent, list_project_agents and select that accessible agent. Otherwise get_user_agent_preferences; if no default, list_project_agents and select.
3. create_agent_thread → create_agent_thread_message with the user's exact prompt → generate_agent_response.
4. Return the generated answer. On generate failure, report the upstream error — do not silently switch to data-analyst or semantic-layer.`,
        invariantIds,
        requiredTopics: [TOPIC_CONVERSATION],
      }),
  );

  server.registerPrompt(
    'continue_lightdash_ai_agent',
    {
      title: 'Continue Lightdash AI Agent thread',
      description: 'Add a follow-up to an existing accessible AI-agent thread and generate',
      argsSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: z.string().optional(),
        threadUuid: z.string().optional(),
        question: z.string(),
      },
    },
    ({ projectUuid, agentUuid, threadUuid, question }) =>
      promptContext({
        task: `Continue a managed Lightdash AI Agent conversation.

${formatPromptProjectUuidLine(projectUuid)}
Agent: ${agentUuid ?? '(from current context or list_project_agents)'}.
Thread: ${threadUuid ?? '(reuse known threadUuid, else list_agent_threads)'}.
Follow-up: ${question}

Procedure:
1. Reuse agentUuid/threadUuid from context when reliable. Otherwise list_agent_threads (includeMessageText only if identification needs conversation text).
2. create_agent_thread_message with the exact follow-up, then generate_agent_response.
3. Do not create a second message when retrying generate after a failed generation.`,
        invariantIds,
        requiredTopics: [TOPIC_CONVERSATION],
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
