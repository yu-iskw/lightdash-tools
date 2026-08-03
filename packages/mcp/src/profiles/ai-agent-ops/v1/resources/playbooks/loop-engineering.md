# AI agent-ops — loop engineering

URI: `lightdash://playbooks/ai-agent-ops/loop-engineering`

## Loop (host-owned)

1. Snapshot intent: record agent UUID + version from `get_project_agent`
2. Baseline: product evaluation run via MCP
3. Analyze failures in the host (instruction vs tags vs semantic metadata vs access)
4. Intervene outside this profile:
   - Semantic / AI hints → optional `semantic-layer` MCP or out-of-band
   - Content → optional `content-reader` / developer workflows
   - Agent config / eval suites as Git → CLI `agentops plan|apply`
5. Regress with focused then full evaluation runs
6. Gate with CLI `agentops evaluate-gate`
7. Stop after gates pass, no safe intervention remains, or 3 iterations

## Priority of interventions

```text
correct semantic fact
→ improve metadata/AI hints
→ adjust tags/scope
→ curate knowledge/verified examples
→ revise instruction via agentops/CLI
```

Do not recommend prompt patches when semantic metadata is demonstrably wrong.
