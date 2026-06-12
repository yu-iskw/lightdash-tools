import { normalizeEvaluationPrompt } from './types';

import type { AgentStateSnapshot, EvaluationStateSnapshot, GateRunSnapshot } from './types';

export function toGateRunSnapshot(run: {
  runUuid: string;
  status: GateRunSnapshot['status'];
  passedAssessments: number;
  failedAssessments: number;
  completedAt: string | null;
}): GateRunSnapshot {
  return {
    runUuid: run.runUuid,
    status: run.status,
    passedAssessments: run.passedAssessments,
    failedAssessments: run.failedAssessments,
    completedAt: run.completedAt,
  };
}

export function toAgentSnapshot(agent: {
  uuid: string;
  name: string;
  description: string | null;
  instruction: string | null;
  tags: string[] | null;
  enableDataAccess?: boolean;
  enableSelfImprovement?: boolean;
}): AgentStateSnapshot {
  return {
    uuid: agent.uuid,
    name: agent.name,
    description: agent.description,
    instruction: agent.instruction,
    tags: agent.tags,
    enableDataAccess: agent.enableDataAccess,
    enableSelfImprovement: agent.enableSelfImprovement,
  };
}

export function toEvaluationSnapshot(evaluation: {
  evalUuid: string;
  title: string;
  description: string | null;
  prompts: Array<
    | { type?: 'string'; prompt: string; expectedResponse: string | null }
    | { type?: 'thread'; threadUuid: string; promptUuid: string; expectedResponse: string | null }
  >;
}): EvaluationStateSnapshot {
  return {
    evalUuid: evaluation.evalUuid,
    title: evaluation.title,
    description: evaluation.description,
    prompts: evaluation.prompts.map((p) => normalizeEvaluationPrompt(p)),
  };
}
