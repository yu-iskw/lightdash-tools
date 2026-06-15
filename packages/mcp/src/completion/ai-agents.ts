/**
 * MCP completion providers for AI agent identifiers (project, agent, evaluation).
 */

import { areAllProjectsAllowed } from '@lightdash-tools/common';

import { getAllowedProjectUuids } from '../config.js';

import type { McpContextProvider } from '../request-context.js';

type CompletionContext = { arguments?: Record<string, string> } | undefined;

function filterByPrefix(values: string[], prefix: string): string[] {
  const normalized = prefix.toLowerCase();
  return values.filter((v) => v.toLowerCase().startsWith(normalized));
}

function allowedProjectUuids(projectUuids: string[]): string[] {
  const allowlist = getAllowedProjectUuids();
  if (allowlist.length === 0) {
    return projectUuids;
  }
  return projectUuids.filter((uuid) => areAllProjectsAllowed(allowlist, [uuid]));
}

function isContextProjectAllowed(projectUuid: string | undefined): projectUuid is string {
  if (!projectUuid) {
    return false;
  }
  const allowlist = getAllowedProjectUuids();
  if (allowlist.length === 0) {
    return true;
  }
  return areAllProjectsAllowed(allowlist, [projectUuid]);
}

/** Completes project UUIDs from the organization project list. */
export function createProjectUuidCompleter(contextProvider: McpContextProvider) {
  return async (value: string, _context?: CompletionContext): Promise<string[]> => {
    void _context;
    const { lightdashClient } = await contextProvider.getContext();
    const projects = await lightdashClient.v1.projects.listProjects();
    const uuids = allowedProjectUuids(projects.map((p) => p.projectUuid));
    return filterByPrefix(uuids, value);
  };
}

/** Completes agent UUIDs scoped to projectUuid in completion context. */
export function createAgentUuidCompleter(contextProvider: McpContextProvider) {
  return async (value: string, context?: CompletionContext): Promise<string[]> => {
    const projectUuid = context?.arguments?.projectUuid;
    if (!isContextProjectAllowed(projectUuid)) {
      return [];
    }
    const { lightdashClient } = await contextProvider.getContext();
    const agents = await lightdashClient.v1.aiAgents.listAgents(projectUuid);
    const uuids = agents.map((a) => a.uuid);
    return filterByPrefix(uuids, value);
  };
}

/** Completes evaluation UUIDs scoped to projectUuid and agentUuid in context. */
export function createEvalUuidCompleter(contextProvider: McpContextProvider) {
  return async (value: string, context?: CompletionContext): Promise<string[]> => {
    const projectUuid = context?.arguments?.projectUuid;
    const agentUuid = context?.arguments?.agentUuid;
    if (!isContextProjectAllowed(projectUuid) || !agentUuid) {
      return [];
    }
    const { lightdashClient } = await contextProvider.getContext();
    const evaluations = await lightdashClient.v1.aiAgents.listEvaluations(projectUuid, agentUuid);
    const uuids = evaluations.map((e) => e.evalUuid);
    return filterByPrefix(uuids, value);
  };
}

/** Completes evaluation run UUIDs scoped to project, agent, and evaluation in context. */
export function createRunUuidCompleter(contextProvider: McpContextProvider) {
  return async (value: string, context?: CompletionContext): Promise<string[]> => {
    const projectUuid = context?.arguments?.projectUuid;
    const agentUuid = context?.arguments?.agentUuid;
    const evalUuid = context?.arguments?.evalUuid;
    if (!isContextProjectAllowed(projectUuid) || !agentUuid || !evalUuid) {
      return [];
    }
    const { lightdashClient } = await contextProvider.getContext();
    const runs = await lightdashClient.v1.aiAgents.listAllEvaluationRuns(
      projectUuid,
      agentUuid,
      evalUuid,
    );
    const uuids = runs.map((r) => r.runUuid);
    return filterByPrefix(uuids, value);
  };
}
