/**
 * P0 AI agent operations registered in the shared operation registry.
 */

import {
  READ_ONLY_DEFAULT,
  WRITE_DESTRUCTIVE,
  WRITE_IDEMPOTENT,
  WRITE_NONDESTRUCTIVE,
  WRITE_OPEN_WORLD,
} from '../safety';

import { defineOperation } from './types';

import type { CapabilityProfile, OperationDescriptor, SafetyImpact } from './types';

const IMPACT_READ: SafetyImpact = 'read';
const IMPACT_WRITE_NONDESTRUCTIVE: SafetyImpact = 'write-nondestructive';
const IMPACT_WRITE_DESTRUCTIVE: SafetyImpact = 'write-destructive';
const IMPACT_EXTERNAL: SafetyImpact = 'external-side-effect';

const PROFILE_CORE_LIFECYCLE: CapabilityProfile = 'core-lifecycle';
const PROFILE_DISCOVERY: CapabilityProfile = 'discovery-readonly';
const PROFILE_CONVERSATIONS: CapabilityProfile = 'conversations';
const PROFILE_EVALUATIONS: CapabilityProfile = 'evaluations';

const API_V1 = '/api/v1';
const PROJECT_AGENTS_PATH = `${API_V1}/projects/{projectUuid}/aiAgents`;
const PROJECT_AGENT_PATH = `${PROJECT_AGENTS_PATH}/{agentUuid}`;

const adminListAgents = defineOperation({
  id: 'ai-agents.admin.agents.list',
  summary: 'List all AI agents across the organization (admin)',
  http: { method: 'GET', path: `${API_V1}/aiAgents/admin/agents` },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_admin_agents',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'ai-agents list' },
  profiles: [PROFILE_CORE_LIFECYCLE, PROFILE_DISCOVERY],
});

const adminListThreads = defineOperation({
  id: 'ai-agents.admin.threads.list',
  summary: 'List AI agent threads across the organization with optional filters (admin)',
  http: { method: 'GET', path: `${API_V1}/aiAgents/admin/threads` },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_admin_agent_threads',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'ai-agents threads' },
  profiles: [PROFILE_DISCOVERY],
});

const adminSettingsGet = defineOperation({
  id: 'ai-agents.admin.settings.get',
  summary: 'Get AI organization settings (admin)',
  http: { method: 'GET', path: `${API_V1}/aiAgents/admin/settings` },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_ai_organization_settings',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'ai-agents settings get' },
  profiles: [PROFILE_CORE_LIFECYCLE, PROFILE_DISCOVERY],
});

const adminSettingsUpdate = defineOperation({
  id: 'ai-agents.admin.settings.update',
  summary: 'Update AI organization settings (admin)',
  http: { method: 'PATCH', path: `${API_V1}/aiAgents/admin/settings` },
  authorization: { safetyImpact: IMPACT_WRITE_NONDESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'update_ai_organization_settings',
    annotations: WRITE_IDEMPOTENT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'ai-agents settings update' },
  profiles: [PROFILE_CORE_LIFECYCLE],
});

const projectAgentsList = defineOperation({
  id: 'ai-agents.project.agents.list',
  summary: 'List all AI agents in a project',
  http: { method: 'GET', path: PROJECT_AGENTS_PATH },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_project_agents',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents list' },
  profiles: [PROFILE_CORE_LIFECYCLE, PROFILE_DISCOVERY],
});

const projectAgentsGet = defineOperation({
  id: 'ai-agents.project.agents.get',
  summary: 'Get a single AI agent in a project',
  http: { method: 'GET', path: PROJECT_AGENT_PATH },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_project_agent',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents get' },
  profiles: [PROFILE_CORE_LIFECYCLE, PROFILE_DISCOVERY],
});

const projectAgentsCreate = defineOperation({
  id: 'ai-agents.project.agents.create',
  summary: 'Create a new AI agent in a project',
  http: { method: 'POST', path: PROJECT_AGENTS_PATH },
  authorization: { safetyImpact: IMPACT_WRITE_NONDESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'create_project_agent',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents create' },
  profiles: [PROFILE_CORE_LIFECYCLE],
});

const projectAgentsUpdate = defineOperation({
  id: 'ai-agents.project.agents.update',
  summary: 'Update an existing AI agent in a project',
  http: { method: 'PATCH', path: PROJECT_AGENT_PATH },
  authorization: { safetyImpact: IMPACT_WRITE_NONDESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'update_project_agent',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents update' },
  profiles: [PROFILE_CORE_LIFECYCLE],
});

const projectAgentsDelete = defineOperation({
  id: 'ai-agents.project.agents.delete',
  summary: 'Delete an AI agent from a project',
  http: { method: 'DELETE', path: PROJECT_AGENT_PATH },
  authorization: { safetyImpact: IMPACT_WRITE_DESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'delete_project_agent',
    annotations: WRITE_DESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents delete' },
  profiles: [PROFILE_CORE_LIFECYCLE],
});

const PROJECT_AGENT_THREADS_PATH = `${PROJECT_AGENT_PATH}/threads`;

const threadsList = defineOperation({
  id: 'ai-agents.project.threads.list',
  summary: 'List conversation threads for an agent',
  http: {
    method: 'GET',
    path: PROJECT_AGENT_THREADS_PATH,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_agent_threads',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents threads list' },
  profiles: [PROFILE_CONVERSATIONS, PROFILE_DISCOVERY],
});

const PROJECT_AGENT_THREAD_PATH = `${PROJECT_AGENT_THREADS_PATH}/{threadUuid}`;

const threadsGet = defineOperation({
  id: 'ai-agents.project.threads.get',
  summary: 'Get a conversation thread with all messages',
  http: {
    method: 'GET',
    path: PROJECT_AGENT_THREAD_PATH,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_agent_thread',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents threads get' },
  profiles: [PROFILE_CONVERSATIONS, PROFILE_DISCOVERY],
});

const PROJECT_AGENT_THREAD_MESSAGES_PATH = `${PROJECT_AGENT_THREAD_PATH}/messages`;
const PROJECT_AGENT_THREAD_GENERATE_PATH = `${PROJECT_AGENT_THREAD_PATH}/generate`;

const threadsStart = defineOperation({
  id: 'ai-agents.project.threads.start',
  summary:
    'Start a new conversation (client workflow: create thread, add message, generate response)',
  http: {
    method: 'POST',
    path: PROJECT_AGENT_THREADS_PATH,
  },
  workflow: [
    {
      method: 'POST',
      path: PROJECT_AGENT_THREADS_PATH,
      summary: 'Create thread',
    },
    {
      method: 'POST',
      path: PROJECT_AGENT_THREAD_MESSAGES_PATH,
      summary: 'Add user message',
    },
    {
      method: 'POST',
      path: PROJECT_AGENT_THREAD_GENERATE_PATH,
      summary: 'Generate agent response',
    },
  ],
  authorization: { safetyImpact: IMPACT_EXTERNAL },
  sensitivity: 'none',
  mcp: {
    toolName: 'generate_agent_message',
    annotations: WRITE_OPEN_WORLD,
    taskSupport: { exposed: false, taskEligible: true },
  },
  cli: { commandPath: 'agents threads start' },
  profiles: [PROFILE_CONVERSATIONS],
});

const threadsContinue = defineOperation({
  id: 'ai-agents.project.threads.continue',
  summary: 'Continue an existing conversation (client workflow: add message, generate response)',
  http: {
    method: 'POST',
    path: PROJECT_AGENT_THREAD_GENERATE_PATH,
  },
  workflow: [
    {
      method: 'POST',
      path: PROJECT_AGENT_THREAD_MESSAGES_PATH,
      summary: 'Add user message',
    },
    {
      method: 'POST',
      path: PROJECT_AGENT_THREAD_GENERATE_PATH,
      summary: 'Generate agent response',
    },
  ],
  authorization: { safetyImpact: IMPACT_EXTERNAL },
  sensitivity: 'none',
  mcp: {
    toolName: 'continue_agent_thread',
    annotations: WRITE_OPEN_WORLD,
    taskSupport: { exposed: false, taskEligible: true },
  },
  cli: { commandPath: 'agents threads continue' },
  profiles: [PROFILE_CONVERSATIONS],
});

const PROJECT_AGENT_EVALUATIONS_PATH = `${PROJECT_AGENT_PATH}/evaluations`;

const evaluationsList = defineOperation({
  id: 'ai-agents.project.evaluations.list',
  summary: 'List all evaluations for an agent',
  http: {
    method: 'GET',
    path: PROJECT_AGENT_EVALUATIONS_PATH,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_agent_evaluations',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals list' },
  profiles: [PROFILE_EVALUATIONS, PROFILE_DISCOVERY],
});

const PROJECT_AGENT_EVALUATION_PATH = `${PROJECT_AGENT_EVALUATIONS_PATH}/{evalUuid}`;

const evaluationsGet = defineOperation({
  id: 'ai-agents.project.evaluations.get',
  summary: 'Get a full evaluation including test prompts',
  http: {
    method: 'GET',
    path: PROJECT_AGENT_EVALUATION_PATH,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_agent_evaluation',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals get' },
  profiles: [PROFILE_EVALUATIONS, PROFILE_DISCOVERY],
});

const evaluationsCreate = defineOperation({
  id: 'ai-agents.project.evaluations.create',
  summary: 'Create a new evaluation test suite for an agent',
  http: {
    method: 'POST',
    path: PROJECT_AGENT_EVALUATIONS_PATH,
  },
  authorization: { safetyImpact: IMPACT_WRITE_NONDESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'create_agent_evaluation',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals create' },
  profiles: [PROFILE_EVALUATIONS],
});

const evaluationsUpdate = defineOperation({
  id: 'ai-agents.project.evaluations.update',
  summary: 'Update an evaluation title, description, or prompts',
  http: {
    method: 'PATCH',
    path: PROJECT_AGENT_EVALUATION_PATH,
  },
  authorization: { safetyImpact: IMPACT_WRITE_NONDESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'update_agent_evaluation',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals update' },
  profiles: [PROFILE_EVALUATIONS],
});

const evaluationsAppend = defineOperation({
  id: 'ai-agents.project.evaluations.append',
  summary: 'Append additional prompts to an existing evaluation',
  http: {
    method: 'POST',
    path: `${PROJECT_AGENT_EVALUATION_PATH}/append`,
  },
  authorization: { safetyImpact: IMPACT_WRITE_NONDESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'append_agent_evaluation_prompts',
    annotations: WRITE_NONDESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals append' },
  profiles: [PROFILE_EVALUATIONS],
});

const evaluationsDelete = defineOperation({
  id: 'ai-agents.project.evaluations.delete',
  summary: 'Delete an evaluation and all its runs',
  http: {
    method: 'DELETE',
    path: PROJECT_AGENT_EVALUATION_PATH,
  },
  authorization: { safetyImpact: IMPACT_WRITE_DESTRUCTIVE },
  sensitivity: 'none',
  mcp: {
    toolName: 'delete_agent_evaluation',
    annotations: WRITE_DESTRUCTIVE,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals delete' },
  profiles: [PROFILE_EVALUATIONS],
});

const evaluationsRun = defineOperation({
  id: 'ai-agents.project.evaluations.run',
  summary: 'Trigger a new evaluation run for an agent',
  http: {
    method: 'POST',
    path: `${PROJECT_AGENT_EVALUATION_PATH}/run`,
  },
  authorization: { safetyImpact: IMPACT_EXTERNAL },
  sensitivity: 'none',
  mcp: {
    toolName: 'run_agent_evaluation',
    annotations: WRITE_OPEN_WORLD,
    taskSupport: { exposed: false, taskEligible: true },
  },
  cli: { commandPath: 'agents evals run' },
  profiles: [PROFILE_EVALUATIONS],
});

const PROJECT_AGENT_EVALUATION_RUNS_PATH = `${PROJECT_AGENT_EVALUATION_PATH}/runs`;

const evaluationsRunsList = defineOperation({
  id: 'ai-agents.project.evaluations.runs.list',
  summary: 'List all runs for an evaluation with status and pass/fail counts',
  http: {
    method: 'GET',
    path: PROJECT_AGENT_EVALUATION_RUNS_PATH,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'list_agent_evaluation_runs',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals runs' },
  profiles: [PROFILE_EVALUATIONS, PROFILE_DISCOVERY],
});

const evaluationsRunResultsGet = defineOperation({
  id: 'ai-agents.project.evaluations.runs.get',
  summary: 'Get detailed per-prompt results for a specific evaluation run',
  http: {
    method: 'GET',
    path: `${PROJECT_AGENT_EVALUATION_RUNS_PATH}/{runUuid}`,
  },
  authorization: { safetyImpact: IMPACT_READ },
  sensitivity: 'none',
  mcp: {
    toolName: 'get_agent_evaluation_run_results',
    annotations: READ_ONLY_DEFAULT,
    taskSupport: { exposed: false, taskEligible: false },
  },
  cli: { commandPath: 'agents evals run-results' },
  profiles: [PROFILE_EVALUATIONS, PROFILE_DISCOVERY],
});

/** All registered P0 AI agent operations. */
export const AI_AGENT_OPERATIONS: readonly OperationDescriptor[] = [
  adminListAgents,
  adminListThreads,
  adminSettingsGet,
  adminSettingsUpdate,
  projectAgentsList,
  projectAgentsGet,
  projectAgentsCreate,
  projectAgentsUpdate,
  projectAgentsDelete,
  threadsList,
  threadsGet,
  threadsStart,
  threadsContinue,
  evaluationsList,
  evaluationsGet,
  evaluationsCreate,
  evaluationsUpdate,
  evaluationsAppend,
  evaluationsDelete,
  evaluationsRun,
  evaluationsRunsList,
  evaluationsRunResultsGet,
];
