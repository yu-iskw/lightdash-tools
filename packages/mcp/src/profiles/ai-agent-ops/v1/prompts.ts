/**
 * MCP prompts for ai-agent-ops workflows (ADR-0018).
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches other profile prompt registration */
import { z } from 'zod';

import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  AI_AGENT_OPS_CORE_PLAYBOOK,
  AI_AGENT_OPS_HARD_BANS,
  AI_AGENT_OPS_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: AI_AGENT_OPS_CORE_PLAYBOOK,
  topics: AI_AGENT_OPS_TOPIC_PLAYBOOKS,
});

export function registerAiAgentOpsPrompts(server: McpServer): void {
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
      userMessages(
        `Audit the selected project-level Lightdash AI agent.

${AI_AGENT_OPS_HARD_BANS}

Agent: ${agentUuid ?? '(list_project_agents then select)'}

Procedure (primitives only):
1. Resolve project scope.
2. list/get the agent; review instruction, tags, access flags, integrations, self-improvement.
3. Optionally evaluate_agent_readiness — label as readiness API, not e2e.
4. List evaluations and recent runs; note coverage gaps.
5. Distinguish API facts, readiness signals, evaluation evidence, assumptions, and unknowns.
6. Do not mutate the agent or claim compliance.`,
      ),
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
      userMessages(
        `Design or update an offline evaluation suite for agent ${agentUuid ?? '(select after list)'}.

${AI_AGENT_OPS_HARD_BANS}

Inspect agent configuration first. Prefer create/update/append_agent_evaluation tools.
Include common questions, ambiguity, access/refusal, and must-pass cases.
Prefer deterministic expected responses. Do not invent local Git dataset MCP tools.`,
        'evaluation',
      ),
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
      userMessages(
        `Run a baseline evaluation for agent ${agentUuid ?? '(select)'} suite ${evalUuid ?? '(select)'}.

${AI_AGENT_OPS_HARD_BANS}

Use run_agent_evaluation then poll list_agent_evaluation_runs and get_agent_eval_run_results.
Never silently substitute evaluate_agent_readiness for an evaluation run.
Report run UUID, status, limitations, and hard failures from the product results.`,
        'evaluation',
      ),
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
      userMessages(
        `Investigate evaluation failures for run ${runUuid ?? '(from get_agent_eval_run_results)'}.

${AI_AGENT_OPS_HARD_BANS}

There is no lightdash_analyze_* tool. Fetch run results, cluster by root cause in the conversation,
cite evidence, separate confirmed causes from hypotheses, and recommend the narrowest intervention.
Prefer metadata fixes before instruction patches.`,
        'loop-engineering',
      ),
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
      userMessages(
        `Guide a bounded loop-engineering workflow for agent ${agentUuid ?? '(select)'}.

${AI_AGENT_OPS_HARD_BANS}

Max iterations: ${maxIterations ?? '3'}.
Use MCP for inspect/eval runs; CLI agentops for bundle apply and gates; other profiles for semantic/content when available.
Implementation changes happen outside agent CRUD on this server.
Stop when gates pass, no safe intervention remains, or the budget is exhausted.`,
        'loop-engineering',
      ),
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
      userMessages(
        `Review access and scope for agent ${agentUuid ?? '(select)'}.

${AI_AGENT_OPS_HARD_BANS}

Use get_project_agent and get_explore_access_summary. Note unexpectedly broad/narrow tags,
data-access inconsistencies, and self-improvement risk. Do not mutate access.`,
      ),
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
      userMessages(
        `Assess self-improvement configuration for agent ${agentUuid ?? '(select)'}.

${AI_AGENT_OPS_HARD_BANS}

Consider access breadth, data access, evaluation coverage, release gates, and rollback readiness.
Do not approve or apply proposals.`,
      ),
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
      userMessages(
        `Compare baseline run ${baselineRunUuid ?? '(uuid)'} vs candidate ${candidateRunUuid ?? '(uuid)'}.

${AI_AGENT_OPS_HARD_BANS}

Fetch both via get_agent_eval_run_results. Check suite/agent/mode comparability before ranking.
Hard failures beat average scores. Never prefer a candidate with a critical regression.`,
        'evaluation',
      ),
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
      userMessages(
        `Prepare a release recommendation for agent ${agentUuid ?? '(select)'} using run ${runUuid ?? '(select)'}.

${AI_AGENT_OPS_HARD_BANS}

Require MCP run results plus CLI agentops evaluate-gate evidence when available.
Return PASS, CONDITIONAL, or FAIL with risks and rollback notes. Do not deploy.`,
        'release-gate',
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
