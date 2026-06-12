import type { GatePolicyEvaluation, LightdashAiEvaluationGate } from './types';

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function formatGateJUnit(
  gate: LightdashAiEvaluationGate,
  evaluation: GatePolicyEvaluation,
): string {
  const name = escapeXml(gate.metadata.name);
  const failures = evaluation.passed
    ? ''
    : `    <failure message="${escapeXml(evaluation.reasons.join('; '))}">Gate policy failed</failure>\n`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${name}" tests="1" failures="${evaluation.passed ? 0 : 1}">\n  <testcase name="${name}" classname="agentops.evaluate-gate">\n${failures}  </testcase>\n</testsuite>\n`;
}

export function formatGateTimeoutJUnit(gate: LightdashAiEvaluationGate): string {
  const name = escapeXml(gate.metadata.name);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${name}" tests="1" failures="1">\n  <testcase name="timeout"><failure>Timed out</failure></testcase>\n</testsuite>\n`;
}

export function formatGateTimeoutMarkdown(gate: LightdashAiEvaluationGate): string {
  return `# Evaluation Gate: ${gate.metadata.name}\n\n**Result:** TIMEOUT\n`;
}

export function formatGateMarkdown(
  gate: LightdashAiEvaluationGate,
  evaluation: GatePolicyEvaluation,
): string {
  const lines = [
    `# Evaluation Gate: ${gate.metadata.name}`,
    '',
    `**Result:** ${evaluation.passed ? 'PASSED' : 'FAILED'} (exit ${evaluation.exitCode})`,
    '',
    '## Metrics',
    `- Run status: ${evaluation.metrics.runStatus}`,
    `- Passed assessments: ${evaluation.metrics.passedAssessments}`,
    `- Failed assessments: ${evaluation.metrics.failedAssessments}`,
    `- Pass rate: ${evaluation.metrics.passRate ?? 'n/a'}`,
    '',
  ];
  if (evaluation.reasons.length > 0) {
    lines.push('## Reasons', ...evaluation.reasons.map((r) => `- ${r}`), '');
  }
  return lines.join('\n');
}
