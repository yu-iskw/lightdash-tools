# AI agent-ops — release gate

URI: `lightdash://playbooks/ai-agent-ops/release-gate`

## MCP role

Fetch run results with `get_agent_eval_run_results`. Do **not** treat aggregate scores from conversation synthesis as a release decision.

## CLI role

Use `lightdash-tools agentops evaluate-gate` with a `LightdashAiEvaluationGate` document against a completed run. Bundle drift/plan/apply remain CLI/`agentops`.

## Decision outputs (host)

Return `PASS`, `CONDITIONAL`, or `FAIL` with:

- hard-gate failures
- new regressions vs baseline run
- unresolved risks
- rollback notes

Never deploy or mutate the agent from this MCP persona.
