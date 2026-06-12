/**
 * MCP tools: AgentOps bundle plan/apply and evaluation gate workflows (RFC Phase 2).
 */

import {
  applyBundleDiff,
  fetchBundleCurrentState,
  resolveEvaluationRun,
} from '@lightdash-tools/client';
import {
  GateExitCode,
  WRITE_NONDESTRUCTIVE,
  WRITE_OPEN_WORLD,
  computeBundleDiff,
  evaluateGatePolicy,
  formatGateJUnit,
  formatGateMarkdown,
  isAllowed,
  parseLightdashAiAgentBundle,
  parseLightdashAiEvaluationGate,
} from '@lightdash-tools/common';
import { z } from 'zod';

import { getSafetyMode } from '../config.js';
import { blockIfProjectNotAllowed } from '../utils/allowlist.js';

import {
  jsonToolResult,
  registerToolSafe,
  READ_ONLY_DEFAULT,
  wrapTool,
  WRITE_DESTRUCTIVE,
} from './shared.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const bundleYamlField = z.string().min(1).describe('Agent bundle document as YAML text');
const gateYamlField = z.string().min(1).describe('Evaluation gate document as YAML text');

export function registerAgentopsTools(server: McpServer, client: LightdashClient): void {
  registerToolSafe(
    server,
    'ai_agentops_plan',
    {
      title: 'AgentOps plan bundle',
      description:
        'Validate an agent bundle YAML document, fetch current Lightdash state, and return the planned diff (read-only)',
      inputSchema: {
        bundleYaml: bundleYamlField,
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(client, (c) => async ({ bundleYaml }: { bundleYaml: string }) => {
      const bundle = parseLightdashAiAgentBundle(bundleYaml);
      const blocked = blockIfProjectNotAllowed(bundle.spec.projectUuid);
      if (blocked) return blocked;
      const current = await fetchBundleCurrentState(c, bundle);
      const diff = computeBundleDiff(bundle, current);
      return jsonToolResult(diff);
    }),
  );

  registerToolSafe(
    server,
    'ai_agentops_apply',
    {
      title: 'AgentOps apply bundle',
      description: 'Apply an agent bundle YAML document to Lightdash',
      inputSchema: {
        bundleYaml: bundleYamlField,
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(client, (c) => async ({ bundleYaml }: { bundleYaml: string }) => {
      const bundle = parseLightdashAiAgentBundle(bundleYaml);
      const blocked = blockIfProjectNotAllowed(bundle.spec.projectUuid);
      if (blocked) return blocked;
      const current = await fetchBundleCurrentState(c, bundle);
      const diff = computeBundleDiff(bundle, current);

      if (diff.summary.deletes > 0 && !isAllowed(getSafetyMode(), WRITE_DESTRUCTIVE)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Error: bundle requires destructive operations (deletes). Use safety mode write-destructive.',
            },
          ],
          isError: true,
        };
      }

      const result = await applyBundleDiff(c, bundle, diff.changes);
      const payload = {
        bundleName: bundle.metadata.name,
        projectUuid: bundle.spec.projectUuid,
        summary: diff.summary,
        applied: result.applied,
        skipped: result.skipped,
        failed: result.failed,
      };
      if (result.failed.length > 0) {
        return {
          ...jsonToolResult(payload),
          isError: true,
        };
      }
      return jsonToolResult(payload);
    }),
  );

  registerToolSafe(
    server,
    'ai_agentops_evaluate_gate',
    {
      title: 'AgentOps evaluate gate',
      description:
        'Evaluate an evaluation gate YAML policy against a run (may trigger a new run when spec.triggerRun is true)',
      inputSchema: {
        gateYaml: gateYamlField,
        wait: z
          .boolean()
          .optional()
          .describe('Wait for the evaluation run to complete (default false)'),
        timeoutSeconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Wait timeout in seconds (default 600)'),
        pollIntervalSeconds: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Poll interval in seconds when waiting (default 10)'),
        output: z
          .enum(['json', 'junit', 'markdown'])
          .optional()
          .describe('Output format (default json)'),
      },
      annotations: WRITE_OPEN_WORLD,
    },
    wrapTool(
      client,
      (c) =>
        async ({
          gateYaml,
          wait,
          timeoutSeconds,
          pollIntervalSeconds,
          output,
        }: {
          gateYaml: string;
          wait?: boolean;
          timeoutSeconds?: number;
          pollIntervalSeconds?: number;
          output?: 'json' | 'junit' | 'markdown';
        }) => {
          const format = output ?? 'json';
          const gate = parseLightdashAiEvaluationGate(gateYaml);
          const blocked = blockIfProjectNotAllowed(gate.spec.projectUuid);
          if (blocked) return blocked;
          const { run, timedOut } = await resolveEvaluationRun(c, gate, {
            wait: wait === true,
            timeoutMs: (timeoutSeconds ?? 600) * 1000,
            pollIntervalMs: (pollIntervalSeconds ?? 10) * 1000,
          });

          if (timedOut) {
            const payload = {
              gateName: gate.metadata.name,
              exitCode: GateExitCode.TIMEOUT,
              passed: false,
              reasons: ['Timed out waiting for evaluation run to complete'],
              run,
            };
            if (format === 'json') {
              return { ...jsonToolResult(payload), isError: true };
            }
            const text =
              format === 'markdown'
                ? `# Evaluation Gate: ${gate.metadata.name}\n\n**Result:** TIMEOUT\n`
                : `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${gate.metadata.name}" tests="1" failures="1">\n  <testcase name="timeout"><failure>Timed out</failure></testcase>\n</testsuite>\n`;
            return { content: [{ type: 'text' as const, text }], isError: true };
          }

          const evaluation = evaluateGatePolicy(gate.spec.policy, run);

          const payload = {
            gateName: gate.metadata.name,
            projectUuid: gate.spec.projectUuid,
            agentUuid: gate.spec.agentUuid,
            evaluationUuid: gate.spec.evaluationUuid,
            runUuid: run.runUuid,
            ...evaluation,
          };

          const isError = !evaluation.passed || evaluation.exitCode !== GateExitCode.PASSED;

          if (format === 'json') {
            return {
              ...jsonToolResult(payload),
              ...(isError ? { isError: true } : {}),
            };
          }
          const text =
            format === 'junit'
              ? formatGateJUnit(gate, evaluation)
              : formatGateMarkdown(gate, evaluation);
          return {
            content: [{ type: 'text' as const, text }],
            ...(isError ? { isError: true } : {}),
          };
        },
    ),
  );
}
