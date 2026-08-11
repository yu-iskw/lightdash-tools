/**
 * MCP prompts for ai-agent-ops workflows (progressive-disclosure context).
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches other profile prompt registration pattern */
import { z } from 'zod';

import {
  DEFAULT_PROMPT_CONTEXT_POLICY,
  type PromptContextPolicy,
} from '../../../config/prompt-context-policy.js';
import { createPromptContextComposer } from '../../lib/prompt-context.js';

import { AI_AGENT_OPS_DEFAULT_INVARIANT_IDS, AI_AGENT_OPS_INVARIANTS } from './invariants.js';
import {
  AI_AGENT_OPS_CORE_PLAYBOOK,
  AI_AGENT_OPS_TOPIC_META,
  AI_AGENT_OPS_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { RegisterPromptsOptions } from '../../types.js';
import type { AiAgentOpsPlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const TOPIC_EVALUATION = 'evaluation' as const satisfies AiAgentOpsPlaybookTopic;
const TOPIC_LOOP_ENGINEERING = 'loop-engineering' as const satisfies AiAgentOpsPlaybookTopic;
const TOPIC_RELEASE_GATE = 'release-gate' as const satisfies AiAgentOpsPlaybookTopic;

function createComposer(policy: PromptContextPolicy) {
  return createPromptContextComposer({
    policy,
    invariants: AI_AGENT_OPS_INVARIANTS,
    core: AI_AGENT_OPS_CORE_PLAYBOOK,
    topics: AI_AGENT_OPS_TOPIC_PLAYBOOKS,
    topicMeta: AI_AGENT_OPS_TOPIC_META,
  });
}

export function registerAiAgentOpsPrompts(
  server: McpServer,
  options?: RegisterPromptsOptions,
): void {
  const policy = options?.promptContextPolicy ?? DEFAULT_PROMPT_CONTEXT_POLICY;
  const promptContext = createComposer(policy);
  const invariantIds = AI_AGENT_OPS_DEFAULT_INVARIANT_IDS;

  server.registerPrompt(
    'audit_project_ai_agent',
    {
      title: 'Audit project AI agent',
      description: 'Inspect agent config, readiness API, and evaluation coverage via primitives',
      argsSchema: {
        agentUuid: z.string().optional().describe('Agent UUID (or select after list)'),
      },
    },
    ({ agentUuid }) =>
      promptContext({
        task: `Audit the selected project-level Lightdash AI agent.

Agent: ${agentUuid ?? '(list_project_agents then select)'}

Procedure (primitives only):
1. Resolve project scope.
2. list/get the agent; review instruction, tags, access flags, integrations, self-improvement.
3. Optionally evaluate_agent_readiness — label as readiness API, not e2e.
4. List evaluations and recent runs; note coverage gaps.
5. Distinguish API facts, readiness signals, evaluation evidence, assumptions, and unknowns.
6. Do not mutate the agent or claim compliance.`,
        invariantIds,
        requiredTopics: [],
      }),
  );

  server.registerPrompt(
    'build_agent_evaluation_suite',
    {
      title: 'Build agent evaluation suite',
      description: 'Design or update a Lightdash evaluation suite via MCP eval APIs',
      argsSchema: {
        agentUuid: z.string().optional(),
      },
    },
    ({ agentUuid }) =>
      promptContext({
        task: `Design or update an offline evaluation suite for agent ${agentUuid ?? '(select after list)'}.

Inspect agent configuration first. Prefer create/update/append_agent_evaluation tools.
Include common questions, ambiguity, access/refusal, and must-pass cases.
Prefer deterministic expected responses. Do not invent local Git dataset MCP tools.`,
        invariantIds,
        requiredTopics: [TOPIC_EVALUATION],
      }),
  );

  server.registerPrompt(
    'run_agent_baseline',
    {
      title: 'Run agent baseline evaluation',
      description: 'Run a Lightdash evaluation suite and fetch results',
      argsSchema: {
        agentUuid: z.string().optional(),
        evalUuid: z.string().optional(),
      },
    },
    ({ agentUuid, evalUuid }) =>
      promptContext({
        task: `Run a baseline evaluation for agent ${agentUuid ?? '(select)'} suite ${evalUuid ?? '(select)'}.

Use run_agent_evaluation then poll list_agent_evaluation_runs and get_agent_eval_run_results.
Never silently substitute evaluate_agent_readiness for an evaluation run.
Report run UUID, status, limitations, and hard failures from the product results.`,
        invariantIds,
        requiredTopics: [TOPIC_EVALUATION],
      }),
  );

  server.registerPrompt(
    'investigate_agent_failures',
    {
      title: 'Investigate agent evaluation failures',
      description: 'Cluster failures in the host from run results (no analyze_* tool)',
      argsSchema: {
        runUuid: z.string().optional(),
      },
    },
    ({ runUuid }) =>
      promptContext({
        task: `Investigate evaluation failures for run ${runUuid ?? '(from get_agent_eval_run_results)'}.

There is no lightdash_analyze_* tool. Fetch run results, cluster by root cause in the conversation,
cite evidence, separate confirmed causes from hypotheses, and recommend the narrowest intervention.
Prefer metadata fixes before instruction patches.`,
        invariantIds,
        requiredTopics: [TOPIC_LOOP_ENGINEERING],
      }),
  );

  server.registerPrompt(
    'improve_agent_with_loop_engineering',
    {
      title: 'Improve agent with loop engineering',
      description: 'Bounded host+CLI+MCP improvement loop',
      argsSchema: {
        agentUuid: z.string().optional(),
        maxIterations: z.string().optional().describe('Default 3'),
      },
    },
    ({ agentUuid, maxIterations }) =>
      promptContext({
        task: `Guide a bounded loop-engineering workflow for agent ${agentUuid ?? '(select)'}.

Max iterations: ${maxIterations ?? '3'}.
Use MCP for inspect/eval runs; CLI agentops for bundle apply and gates; other profiles for semantic/content when available.
Implementation changes happen outside agent CRUD on this server.
Stop when gates pass, no safe intervention remains, or the budget is exhausted.`,
        invariantIds,
        requiredTopics: [TOPIC_LOOP_ENGINEERING],
      }),
  );

  server.registerPrompt(
    'review_agent_access_and_scope',
    {
      title: 'Review agent access and scope',
      description: 'Review tags, data access, and explore reachability',
      argsSchema: {
        agentUuid: z.string().optional(),
      },
    },
    ({ agentUuid }) =>
      promptContext({
        task: `Review access and scope for agent ${agentUuid ?? '(select)'}.

Use get_project_agent and get_explore_access_summary. Note unexpectedly broad/narrow tags,
data-access inconsistencies, and self-improvement risk. Do not mutate access.`,
        invariantIds,
        requiredTopics: [],
      }),
  );

  server.registerPrompt(
    'review_agent_self_improvement',
    {
      title: 'Review agent self-improvement',
      description: 'Assess whether self-improvement is appropriately configured',
      argsSchema: {
        agentUuid: z.string().optional(),
      },
    },
    ({ agentUuid }) =>
      promptContext({
        task: `Assess self-improvement configuration for agent ${agentUuid ?? '(select)'}.

Consider access breadth, data access, evaluation coverage, release gates, and rollback readiness.
Do not approve or apply proposals.`,
        invariantIds,
        requiredTopics: [],
      }),
  );

  server.registerPrompt(
    'compare_agent_candidates',
    {
      title: 'Compare agent evaluation candidates',
      description: 'Compare two evaluation runs for comparability then rank',
      argsSchema: {
        baselineRunUuid: z.string().optional(),
        candidateRunUuid: z.string().optional(),
      },
    },
    ({ baselineRunUuid, candidateRunUuid }) =>
      promptContext({
        task: `Compare baseline run ${baselineRunUuid ?? '(uuid)'} vs candidate ${candidateRunUuid ?? '(uuid)'}.

Fetch both via get_agent_eval_run_results. Check suite/agent/mode comparability before ranking.
Hard failures beat average scores. Never prefer a candidate with a critical regression.`,
        invariantIds,
        requiredTopics: [TOPIC_EVALUATION],
      }),
  );

  server.registerPrompt(
    'prepare_agent_release',
    {
      title: 'Prepare agent release recommendation',
      description: 'Host release judgment using MCP results + CLI agentops gate',
      argsSchema: {
        agentUuid: z.string().optional(),
        runUuid: z.string().optional(),
      },
    },
    ({ agentUuid, runUuid }) =>
      promptContext({
        task: `Prepare a release recommendation for agent ${agentUuid ?? '(select)'} using run ${runUuid ?? '(select)'}.

Require MCP run results plus CLI agentops evaluate-gate evidence when available.
Return PASS, CONDITIONAL, or FAIL with risks and rollback notes. Do not deploy.`,
        invariantIds,
        requiredTopics: [TOPIC_RELEASE_GATE],
      }),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
