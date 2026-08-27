import {
  GateExitCode,
  computeBundleDiff,
  evaluateGatePolicy,
  parseLightdashAiAgentBundle,
  parseLightdashAiEvaluationGate,
} from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

const PROJECT_UUID = '00000000-0000-4000-8000-000000000001';
const AGENT_UUID = '00000000-0000-4000-8000-000000000010';
const EVAL_UUID = '00000000-0000-4000-8000-000000000020';

const validBundleYaml = `
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiAgentBundle
metadata:
  name: sales-bundle
spec:
  projectUuid: ${PROJECT_UUID}
  agents:
    - key: sales
      uuid: ${AGENT_UUID}
      name: Sales Agent
      instruction: Help with sales
      evaluations:
        - key: smoke
          uuid: ${EVAL_UUID}
          title: Smoke Tests
          prompts:
            - prompt: What are total sales?
              expectedResponse: null
`;

const validGateYaml = `
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiEvaluationGate
metadata:
  name: release-gate
spec:
  projectUuid: ${PROJECT_UUID}
  agentUuid: ${AGENT_UUID}
  evaluationUuid: ${EVAL_UUID}
  policy:
    minPassRate: 0.9
    maxFailedAssessments: 0
  triggerRun: true
`;

describe('AgentOps schema validation', () => {
  it('parses a valid LightdashAiAgentBundle', () => {
    const bundle = parseLightdashAiAgentBundle(validBundleYaml);
    expect(bundle.kind).toBe('LightdashAiAgentBundle');
    expect(bundle.metadata.name).toBe('sales-bundle');
    expect(bundle.spec.agents).toHaveLength(1);
    expect(bundle.spec.agents[0]?.key).toBe('sales');
  });

  it('rejects bundle with wrong apiVersion', () => {
    const yaml = validBundleYaml.replace('lightdash.ai/v1alpha1', 'v1');
    expect(() => parseLightdashAiAgentBundle(yaml)).toThrow(/Invalid LightdashAiAgentBundle/);
  });

  it('rejects bundle without agents', () => {
    const yaml = validBundleYaml.replace(/agents:[\s\S]*/, 'agents: []\n');
    expect(() => parseLightdashAiAgentBundle(yaml)).toThrow(/Invalid LightdashAiAgentBundle/);
  });

  it('parses a valid LightdashAiEvaluationGate', () => {
    const gate = parseLightdashAiEvaluationGate(validGateYaml);
    expect(gate.kind).toBe('LightdashAiEvaluationGate');
    expect(gate.spec.policy.minPassRate).toBe(0.9);
    expect(gate.spec.triggerRun).toBe(true);
  });

  it('rejects gate with invalid project UUID', () => {
    const yaml = validGateYaml.replace(PROJECT_UUID, 'not-a-uuid');
    expect(() => parseLightdashAiEvaluationGate(yaml)).toThrow(/Invalid LightdashAiEvaluationGate/);
  });
});

describe('AgentOps bundle diff', () => {
  const bundle = parseLightdashAiAgentBundle(validBundleYaml);

  it('reports noop when current state matches desired state', () => {
    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
          },
          evaluations: [
            {
              evalUuid: EVAL_UUID,
              title: 'Smoke Tests',
              description: null,
              prompts: [
                {
                  type: 'string' as const,
                  prompt: 'What are total sales?',
                  expectedResponse: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const diff = computeBundleDiff(bundle, current);
    expect(diff.hasDrift).toBe(false);
    expect(diff.summary.creates).toBe(0);
    expect(diff.summary.updates).toBe(0);
    expect(diff.summary.deletes).toBe(0);
    expect(diff.summary.noops).toBe(2);
  });

  it('reports create when agent is missing', () => {
    const diff = computeBundleDiff(bundle, { projectUuid: PROJECT_UUID, agents: [] });
    expect(diff.hasDrift).toBe(true);
    expect(diff.summary.creates).toBe(2);
    expect(diff.changes.some((c) => c.resourceType === 'agent' && c.operation === 'create')).toBe(
      true,
    );
  });

  it('reports update when agent instruction drifts', () => {
    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Old instruction',
            tags: null,
          },
          evaluations: [
            {
              evalUuid: EVAL_UUID,
              title: 'Smoke Tests',
              description: null,
              prompts: [
                {
                  type: 'string' as const,
                  prompt: 'What are total sales?',
                  expectedResponse: null,
                },
              ],
            },
          ],
        },
      ],
    };

    const diff = computeBundleDiff(bundle, current);
    expect(diff.summary.updates).toBe(1);
    expect(diff.changes.find((c) => c.resourceType === 'agent')?.fields?.instruction).toEqual({
      from: 'Old instruction',
      to: 'Help with sales',
    });
  });

  it('reports noop when bundle omits enableReasoning and API agent has undefined', () => {
    const bundleWithoutReasoning = parseLightdashAiAgentBundle(`
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiAgentBundle
metadata:
  name: sales-bundle
spec:
  projectUuid: ${PROJECT_UUID}
  agents:
    - key: sales
      uuid: ${AGENT_UUID}
      name: Sales Agent
      instruction: Help with sales
      evaluations: []
`);

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
            enableDataAccess: false,
            enableSelfImprovement: false,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(bundleWithoutReasoning, current);
    expect(diff.hasDrift).toBe(false);
    expect(diff.summary.updates).toBe(0);
    expect(diff.summary.noops).toBe(1);
  });

  it('reports noop when bundle tags are empty array and API has null tags', () => {
    const bundleWithEmptyTags = parseLightdashAiAgentBundle(`
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiAgentBundle
metadata:
  name: sales-bundle
spec:
  projectUuid: ${PROJECT_UUID}
  agents:
    - key: sales
      uuid: ${AGENT_UUID}
      name: Sales Agent
      instruction: Help with sales
      tags: []
      evaluations: []
`);

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(bundleWithEmptyTags, current);
    expect(diff.hasDrift).toBe(false);
    expect(diff.summary.updates).toBe(0);
    expect(diff.summary.noops).toBe(1);
  });

  it('reports noop when API has false booleans and bundle omits them', () => {
    const bundleWithoutBooleans = parseLightdashAiAgentBundle(`
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiAgentBundle
metadata:
  name: sales-bundle
spec:
  projectUuid: ${PROJECT_UUID}
  agents:
    - key: sales
      uuid: ${AGENT_UUID}
      name: Sales Agent
      instruction: Help with sales
      evaluations: []
`);

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
            enableDataAccess: false,
            enableSelfImprovement: false,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(bundleWithoutBooleans, current);
    expect(diff.hasDrift).toBe(false);
    expect(diff.summary.updates).toBe(0);
    expect(diff.summary.noops).toBe(1);
  });

  it('detects drift when bundle sets enableContentTools', () => {
    const bundleWithContentTools = parseLightdashAiAgentBundle(`
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiAgentBundle
metadata:
  name: sales-bundle
spec:
  projectUuid: ${PROJECT_UUID}
  agents:
    - key: sales
      uuid: ${AGENT_UUID}
      name: Sales Agent
      instruction: Help with sales
      enableContentTools: true
      evaluations: []
`);

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
            enableContentTools: false,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(bundleWithContentTools, current);
    expect(diff.summary.updates).toBe(1);
    expect(diff.changes[0]?.operation).toBe('update');
    expect(diff.changes[0]?.fields?.enableContentTools).toEqual({ from: false, to: true });
  });

  it('includes agentUuid on name-matched agent update changes', () => {
    const nameMatchedBundle = parseLightdashAiAgentBundle(`
apiVersion: lightdash.ai/v1alpha1
kind: LightdashAiAgentBundle
metadata:
  name: sales-bundle
spec:
  projectUuid: ${PROJECT_UUID}
  agents:
    - key: sales
      name: Sales Agent
      instruction: Updated instruction
      evaluations: []
`);

    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(nameMatchedBundle, current);
    const agentUpdate = diff.changes.find(
      (c) => c.resourceType === 'agent' && c.operation === 'update',
    );
    expect(agentUpdate?.agentUuid).toBe(AGENT_UUID);
  });

  it('reports delete for agents not in bundle', () => {
    const orphanUuid = '00000000-0000-4000-8000-000000000099';
    const current = {
      projectUuid: PROJECT_UUID,
      agents: [
        {
          agent: {
            uuid: AGENT_UUID,
            name: 'Sales Agent',
            description: null,
            instruction: 'Help with sales',
            tags: null,
          },
          evaluations: [
            {
              evalUuid: EVAL_UUID,
              title: 'Smoke Tests',
              description: null,
              prompts: [
                {
                  type: 'string' as const,
                  prompt: 'What are total sales?',
                  expectedResponse: null,
                },
              ],
            },
          ],
        },
        {
          agent: {
            uuid: orphanUuid,
            name: 'Orphan Agent',
            description: null,
            instruction: null,
            tags: null,
          },
          evaluations: [],
        },
      ],
    };

    const diff = computeBundleDiff(bundle, current);
    expect(diff.changes.some((c) => c.operation === 'delete' && c.key === orphanUuid)).toBe(true);
  });
});

describe('AgentOps evaluate-gate CLI options', () => {
  it('rejects non-numeric timeout values', () => {
    const parse = (value: string) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('--timeout must be a positive integer');
      }
      return parsed;
    };

    expect(() => parse('abc')).toThrow('--timeout must be a positive integer');
    expect(() => parse('0')).toThrow('--timeout must be a positive integer');
    expect(parse('30')).toBe(30);
  });
});

describe('AgentOps gate policy evaluation', () => {
  const baseRun = {
    runUuid: '00000000-0000-4000-8000-000000000030',
    status: 'completed' as const,
    passedAssessments: 9,
    failedAssessments: 1,
    completedAt: '2026-01-01T00:00:00.000Z',
  };

  it('passes when policy thresholds are met', () => {
    const result = evaluateGatePolicy({ minPassRate: 0.8, maxFailedAssessments: 2 }, baseRun);
    expect(result.passed).toBe(true);
    expect(result.exitCode).toBe(GateExitCode.PASSED);
    expect(result.metrics.passRate).toBe(0.9);
  });

  it('fails with POLICY_FAILED when minPassRate is not met', () => {
    const result = evaluateGatePolicy({ minPassRate: 0.95 }, baseRun);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(GateExitCode.POLICY_FAILED);
    expect(result.reasons[0]).toMatch(/minPassRate/);
  });

  it('returns RUN_FAILED for failed runs', () => {
    const result = evaluateGatePolicy(
      { minPassRate: 0.5 },
      { ...baseRun, status: 'failed', passedAssessments: 0, failedAssessments: 0 },
    );
    expect(result.exitCode).toBe(GateExitCode.RUN_FAILED);
  });

  it('returns RUN_IN_PROGRESS for pending runs', () => {
    const result = evaluateGatePolicy(
      { minPassRate: 0.5 },
      { ...baseRun, status: 'running', completedAt: null },
    );
    expect(result.exitCode).toBe(GateExitCode.RUN_IN_PROGRESS);
  });

  it('enforces requireAllPassed', () => {
    const result = evaluateGatePolicy({ requireAllPassed: true }, baseRun);
    expect(result.passed).toBe(false);
    expect(result.exitCode).toBe(GateExitCode.POLICY_FAILED);
  });

  it('fails when maxFailedAssessments exceeded', () => {
    const result = evaluateGatePolicy({ maxFailedAssessments: 0 }, baseRun);
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/maxFailedAssessments/);
  });

  it('fails when minPassedAssessments not met', () => {
    const result = evaluateGatePolicy({ minPassedAssessments: 10 }, baseRun);
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/minPassedAssessments/);
  });

  it('fails minPassRate when no assessments exist', () => {
    const result = evaluateGatePolicy(
      { minPassRate: 0.5 },
      { ...baseRun, passedAssessments: 0, failedAssessments: 0 },
    );
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toMatch(/at least one assessment/);
  });
});
