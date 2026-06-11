/**
 * AgentOps bundle and evaluation gate YAML types (RFC Phase 2).
 * Kubernetes-style documents with apiVersion, kind, metadata, and spec.
 */

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

// ─── Shared metadata ─────────────────────────────────────────────────────────

const metadataSchema = z.object({
  name: z.string().min(1),
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
});

// ─── Bundle schemas ────────────────────────────────────────────────────────────

const bundleEvaluationPromptSchema = z.union([
  z.object({
    prompt: z.string().min(1),
    expectedResponse: z.string().nullable().optional(),
  }),
  z.object({
    threadUuid: z.string().uuid(),
    promptUuid: z.string().uuid(),
    expectedResponse: z.string().nullable().optional(),
  }),
]);

const bundleEvaluationSchema = z.object({
  key: z.string().min(1),
  uuid: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  prompts: z.array(bundleEvaluationPromptSchema).min(1),
});

const bundleAgentSchema = z.object({
  key: z.string().min(1),
  uuid: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  instruction: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  enableDataAccess: z.boolean().optional(),
  enableSelfImprovement: z.boolean().optional(),
  evaluations: z.array(bundleEvaluationSchema).optional().default([]),
});

export const lightdashAiAgentBundleSchema = z.object({
  apiVersion: z.literal('lightdash.ai/v1alpha1'),
  kind: z.literal('LightdashAiAgentBundle'),
  metadata: metadataSchema,
  spec: z.object({
    projectUuid: z.string().uuid(),
    agents: z.array(bundleAgentSchema).min(1),
  }),
});

export type LightdashAiAgentBundle = z.infer<typeof lightdashAiAgentBundleSchema>;
export type BundleAgentSpec = z.infer<typeof bundleAgentSchema>;
export type BundleEvaluationSpec = z.infer<typeof bundleEvaluationSchema>;

// ─── Gate schemas ──────────────────────────────────────────────────────────────

export const gatePolicySchema = z.object({
  minPassRate: z.number().min(0).max(1).optional(),
  maxFailedAssessments: z.number().int().min(0).optional(),
  minPassedAssessments: z.number().int().min(0).optional(),
  requireAllPassed: z.boolean().optional(),
});

export const lightdashAiEvaluationGateSchema = z.object({
  apiVersion: z.literal('lightdash.ai/v1alpha1'),
  kind: z.literal('LightdashAiEvaluationGate'),
  metadata: metadataSchema,
  spec: z.object({
    projectUuid: z.string().uuid(),
    agentUuid: z.string().uuid(),
    evaluationUuid: z.string().uuid(),
    policy: gatePolicySchema,
    runUuid: z.string().uuid().optional(),
    triggerRun: z.boolean().optional().default(false),
  }),
});

export type LightdashAiEvaluationGate = z.infer<typeof lightdashAiEvaluationGateSchema>;
export type GatePolicy = z.infer<typeof gatePolicySchema>;

// ─── Gate exit codes (RFC Phase 2) ─────────────────────────────────────────────

export const GateExitCode = {
  PASSED: 0,
  ERROR: 1,
  INVALID: 2,
  POLICY_FAILED: 3,
  TIMEOUT: 4,
  RUN_FAILED: 5,
  RUN_IN_PROGRESS: 6,
} as const;

export type GateExitCodeValue = (typeof GateExitCode)[keyof typeof GateExitCode];

// ─── Diff / drift types ────────────────────────────────────────────────────────

export type DiffOperation = 'create' | 'delete' | 'noop' | 'update';

export type BundleResourceType = 'agent' | 'evaluation';

export interface BundleDiffChange {
  resourceType: BundleResourceType;
  operation: DiffOperation;
  key: string;
  /** Logical agent key from the bundle spec. */
  agentKey?: string;
  /** Resolved agent UUID when known (required for evaluation API calls). */
  agentUuid?: string;
  /** Resolved evaluation UUID when known (required for title-matched evaluation updates). */
  evaluationUuid?: string;
  path: string;
  fields?: Record<string, { from: unknown; to: unknown }>;
}

export interface BundleDiffResult {
  bundleName: string;
  projectUuid: string;
  changes: BundleDiffChange[];
  hasDrift: boolean;
  summary: {
    creates: number;
    updates: number;
    deletes: number;
    noops: number;
  };
}

/** Minimal agent shape for diffing (from API or desired state). */
export interface AgentStateSnapshot {
  uuid: string;
  name: string;
  description: string | null;
  instruction: string | null;
  tags: string[] | null;
  enableDataAccess?: boolean;
  enableSelfImprovement?: boolean;
}

/** Minimal evaluation shape for diffing. */
export interface EvaluationStateSnapshot {
  evalUuid: string;
  title: string;
  description: string | null;
  prompts: Array<
    | { type: 'string'; prompt: string; expectedResponse: string | null }
    | { type: 'thread'; threadUuid: string; promptUuid: string; expectedResponse: string | null }
  >;
}

export interface BundleCurrentState {
  projectUuid: string;
  agents: Array<{
    agent: AgentStateSnapshot;
    evaluations: EvaluationStateSnapshot[];
  }>;
}

export interface GateRunSnapshot {
  runUuid: string;
  status: 'completed' | 'failed' | 'pending' | 'running';
  passedAssessments: number;
  failedAssessments: number;
  completedAt: string | null;
}

export interface GatePolicyEvaluation {
  exitCode: GateExitCodeValue;
  passed: boolean;
  reasons: string[];
  metrics: {
    passedAssessments: number;
    failedAssessments: number;
    totalAssessments: number;
    passRate: number | null;
    runStatus: GateRunSnapshot['status'];
  };
}

// ─── Parsing & validation ──────────────────────────────────────────────────────

function formatZodError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

export function parseDocumentYaml(content: string): unknown {
  const parsed: unknown = parseYaml(content);
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('YAML document must be a mapping object');
  }
  return parsed;
}

export function parseLightdashAiAgentBundle(content: string): LightdashAiAgentBundle {
  const doc = parseDocumentYaml(content);
  const result = lightdashAiAgentBundleSchema.safeParse(doc);
  if (!result.success) {
    throw new Error(`Invalid LightdashAiAgentBundle: ${formatZodError(result.error)}`);
  }
  return result.data;
}

export function parseLightdashAiEvaluationGate(content: string): LightdashAiEvaluationGate {
  const doc = parseDocumentYaml(content);
  const result = lightdashAiEvaluationGateSchema.safeParse(doc);
  if (!result.success) {
    throw new Error(`Invalid LightdashAiEvaluationGate: ${formatZodError(result.error)}`);
  }
  return result.data;
}

// ─── Prompt normalization ──────────────────────────────────────────────────────

function normalizePrompt(
  prompt:
    | { prompt: string; expectedResponse?: string | null }
    | { threadUuid: string; promptUuid: string; expectedResponse?: string | null },
): EvaluationStateSnapshot['prompts'][number] {
  if ('prompt' in prompt) {
    return {
      type: 'string',
      prompt: prompt.prompt,
      expectedResponse: prompt.expectedResponse ?? null,
    };
  }
  return {
    type: 'thread',
    threadUuid: prompt.threadUuid,
    promptUuid: prompt.promptUuid,
    expectedResponse: prompt.expectedResponse ?? null,
  };
}

function promptsEqual(
  a: EvaluationStateSnapshot['prompts'],
  b: EvaluationStateSnapshot['prompts'],
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function agentFieldsToCompare(_agent: BundleAgentSpec): Array<keyof AgentStateSnapshot> {
  return [
    'name',
    'description',
    'instruction',
    'tags',
    'enableDataAccess',
    'enableSelfImprovement',
  ];
}

/** API defaults omitted bundle booleans to false; normalize before diffing. */
function normalizeAgentBooleanFlag(value: boolean | undefined): boolean {
  return value ?? false;
}

function pickAgentFields(agent: AgentStateSnapshot): Partial<AgentStateSnapshot> {
  return {
    name: agent.name,
    description: agent.description,
    instruction: agent.instruction,
    tags: agent.tags,
    enableDataAccess: normalizeAgentBooleanFlag(agent.enableDataAccess),
    enableSelfImprovement: normalizeAgentBooleanFlag(agent.enableSelfImprovement),
  };
}

function desiredAgentToSnapshot(agent: BundleAgentSpec, uuid: string): AgentStateSnapshot {
  return {
    uuid,
    name: agent.name,
    description: agent.description ?? null,
    instruction: agent.instruction ?? null,
    tags: agent.tags ?? null,
    enableDataAccess: normalizeAgentBooleanFlag(agent.enableDataAccess),
    enableSelfImprovement: normalizeAgentBooleanFlag(agent.enableSelfImprovement),
  };
}

function evaluationToSnapshot(
  evalSpec: BundleEvaluationSpec,
  evalUuid: string,
): EvaluationStateSnapshot {
  return {
    evalUuid,
    title: evalSpec.title,
    description: evalSpec.description ?? null,
    prompts: evalSpec.prompts.map(normalizePrompt),
  };
}

function findAgentMatch(
  desired: BundleAgentSpec,
  current: BundleCurrentState,
): { agent: AgentStateSnapshot; evaluations: EvaluationStateSnapshot[] } | undefined {
  if (desired.uuid) {
    const byUuid = current.agents.find((a) => a.agent.uuid === desired.uuid);
    if (byUuid) return byUuid;
  }
  return current.agents.find((a) => a.agent.name === desired.name);
}

function findEvaluationMatch(
  desired: BundleEvaluationSpec,
  evaluations: EvaluationStateSnapshot[],
): EvaluationStateSnapshot | undefined {
  if (desired.uuid) {
    const byUuid = evaluations.find((e) => e.evalUuid === desired.uuid);
    if (byUuid) return byUuid;
  }
  return evaluations.find((e) => e.title === desired.title);
}

// ─── Diff computation ──────────────────────────────────────────────────────────

export function computeBundleDiff(
  bundle: LightdashAiAgentBundle,
  current: BundleCurrentState,
): BundleDiffResult {
  const changes: BundleDiffChange[] = [];
  const matchedAgentUuids = new Set<string>();

  for (const desiredAgent of bundle.spec.agents) {
    const match = findAgentMatch(desiredAgent, current);
    const agentPath = `spec.agents.${desiredAgent.key}`;

    if (!match) {
      changes.push({
        resourceType: 'agent',
        operation: 'create',
        key: desiredAgent.key,
        path: agentPath,
      });
      for (const desiredEval of desiredAgent.evaluations) {
        changes.push({
          resourceType: 'evaluation',
          operation: 'create',
          key: desiredEval.key,
          agentKey: desiredAgent.key,
          path: `${agentPath}.evaluations.${desiredEval.key}`,
        });
      }
      continue;
    }

    matchedAgentUuids.add(match.agent.uuid);
    const agentUuid = match.agent.uuid;
    const desiredSnapshot = desiredAgentToSnapshot(desiredAgent, agentUuid);
    const fieldDiffs: Record<string, { from: unknown; to: unknown }> = {};

    for (const field of agentFieldsToCompare(desiredAgent)) {
      const fromVal = pickAgentFields(match.agent)[field];
      const toVal = pickAgentFields(desiredSnapshot)[field];
      if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
        fieldDiffs[field] = { from: fromVal, to: toVal };
      }
    }

    if (Object.keys(fieldDiffs).length > 0) {
      changes.push({
        resourceType: 'agent',
        operation: 'update',
        key: desiredAgent.key,
        agentUuid,
        path: agentPath,
        fields: fieldDiffs,
      });
    } else {
      changes.push({
        resourceType: 'agent',
        operation: 'noop',
        key: desiredAgent.key,
        agentUuid,
        path: agentPath,
      });
    }

    for (const desiredEval of desiredAgent.evaluations) {
      const evalMatch = findEvaluationMatch(desiredEval, match.evaluations);
      const evalPath = `${agentPath}.evaluations.${desiredEval.key}`;

      if (!evalMatch) {
        changes.push({
          resourceType: 'evaluation',
          operation: 'create',
          key: desiredEval.key,
          agentKey: desiredAgent.key,
          agentUuid,
          path: evalPath,
        });
        continue;
      }

      const desiredEvalSnapshot = evaluationToSnapshot(desiredEval, evalMatch.evalUuid);
      const evalFieldDiffs: Record<string, { from: unknown; to: unknown }> = {};

      if (evalMatch.title !== desiredEvalSnapshot.title) {
        evalFieldDiffs.title = { from: evalMatch.title, to: desiredEvalSnapshot.title };
      }
      if (evalMatch.description !== desiredEvalSnapshot.description) {
        evalFieldDiffs.description = {
          from: evalMatch.description,
          to: desiredEvalSnapshot.description,
        };
      }
      if (!promptsEqual(evalMatch.prompts, desiredEvalSnapshot.prompts)) {
        evalFieldDiffs.prompts = { from: evalMatch.prompts, to: desiredEvalSnapshot.prompts };
      }

      if (Object.keys(evalFieldDiffs).length > 0) {
        changes.push({
          resourceType: 'evaluation',
          operation: 'update',
          key: desiredEval.key,
          agentKey: desiredAgent.key,
          agentUuid,
          evaluationUuid: evalMatch.evalUuid,
          path: evalPath,
          fields: evalFieldDiffs,
        });
      } else {
        changes.push({
          resourceType: 'evaluation',
          operation: 'noop',
          key: desiredEval.key,
          agentKey: desiredAgent.key,
          agentUuid,
          evaluationUuid: evalMatch.evalUuid,
          path: evalPath,
        });
      }
    }

    for (const existingEval of match.evaluations) {
      const isDesired = desiredAgent.evaluations.some(
        (e) =>
          (e.uuid != null && e.uuid === existingEval.evalUuid) || e.title === existingEval.title,
      );
      if (!isDesired) {
        changes.push({
          resourceType: 'evaluation',
          operation: 'delete',
          key: existingEval.evalUuid,
          agentKey: desiredAgent.key,
          agentUuid,
          path: `${agentPath}.evaluations[${existingEval.evalUuid}]`,
        });
      }
    }
  }

  for (const { agent, evaluations } of current.agents) {
    const isDesired = bundle.spec.agents.some(
      (a) => a.uuid === agent.uuid || a.name === agent.name,
    );
    if (!isDesired && !matchedAgentUuids.has(agent.uuid)) {
      for (const evalItem of evaluations) {
        changes.push({
          resourceType: 'evaluation',
          operation: 'delete',
          key: evalItem.evalUuid,
          agentUuid: agent.uuid,
          path: `agents[${agent.uuid}].evaluations[${evalItem.evalUuid}]`,
        });
      }
      changes.push({
        resourceType: 'agent',
        operation: 'delete',
        key: agent.uuid,
        path: `agents[${agent.uuid}]`,
      });
    }
  }

  const summary = {
    creates: changes.filter((c) => c.operation === 'create').length,
    updates: changes.filter((c) => c.operation === 'update').length,
    deletes: changes.filter((c) => c.operation === 'delete').length,
    noops: changes.filter((c) => c.operation === 'noop').length,
  };

  return {
    bundleName: bundle.metadata.name,
    projectUuid: bundle.spec.projectUuid,
    changes,
    hasDrift: summary.creates + summary.updates + summary.deletes > 0,
    summary,
  };
}

export function detectBundleDrift(
  bundle: LightdashAiAgentBundle,
  current: BundleCurrentState,
): { hasDrift: boolean; diff: BundleDiffResult } {
  const diff = computeBundleDiff(bundle, current);
  return { hasDrift: diff.hasDrift, diff };
}

// ─── Gate policy evaluation ────────────────────────────────────────────────────

export function getLightdashAiAgentBundleJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(lightdashAiAgentBundleSchema) as Record<string, unknown>;
}

export function getLightdashAiEvaluationGateJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(lightdashAiEvaluationGateSchema) as Record<string, unknown>;
}

export function evaluateGatePolicy(policy: GatePolicy, run: GateRunSnapshot): GatePolicyEvaluation {
  const reasons: string[] = [];
  const totalAssessments = run.passedAssessments + run.failedAssessments;
  const passRate = totalAssessments > 0 ? run.passedAssessments / totalAssessments : null;

  if (run.status === 'failed') {
    return {
      exitCode: GateExitCode.RUN_FAILED,
      passed: false,
      reasons: ['Evaluation run failed'],
      metrics: {
        passedAssessments: run.passedAssessments,
        failedAssessments: run.failedAssessments,
        totalAssessments,
        passRate,
        runStatus: run.status,
      },
    };
  }

  if (run.status === 'pending' || run.status === 'running') {
    return {
      exitCode: GateExitCode.RUN_IN_PROGRESS,
      passed: false,
      reasons: [`Evaluation run is ${run.status}`],
      metrics: {
        passedAssessments: run.passedAssessments,
        failedAssessments: run.failedAssessments,
        totalAssessments,
        passRate,
        runStatus: run.status,
      },
    };
  }

  if (policy.minPassRate != null) {
    if (passRate === null) {
      reasons.push('minPassRate requires at least one assessment');
    } else if (passRate < policy.minPassRate) {
      reasons.push(`pass rate ${passRate.toFixed(4)} < minPassRate ${policy.minPassRate}`);
    }
  }

  if (policy.maxFailedAssessments != null && run.failedAssessments > policy.maxFailedAssessments) {
    reasons.push(
      `failed assessments ${run.failedAssessments} > maxFailedAssessments ${policy.maxFailedAssessments}`,
    );
  }

  if (policy.minPassedAssessments != null && run.passedAssessments < policy.minPassedAssessments) {
    reasons.push(
      `passed assessments ${run.passedAssessments} < minPassedAssessments ${policy.minPassedAssessments}`,
    );
  }

  if (policy.requireAllPassed === true && run.failedAssessments > 0) {
    reasons.push(`requireAllPassed: ${run.failedAssessments} failed assessment(s)`);
  }

  const passed = reasons.length === 0;
  return {
    exitCode: passed ? GateExitCode.PASSED : GateExitCode.POLICY_FAILED,
    passed,
    reasons,
    metrics: {
      passedAssessments: run.passedAssessments,
      failedAssessments: run.failedAssessments,
      totalAssessments,
      passRate,
      runStatus: run.status,
    },
  };
}
