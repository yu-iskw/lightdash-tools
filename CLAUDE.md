@AGENTS.md

<!-- AGENTS.md is canonical for every coding agent. Put only Claude Code–specific notes below. -->

## Claude Code

### Parallel Task Execution

For large tasks that can benefit from concurrent work:

```bash
/parallel-executor Add comprehensive logging to all modules
```

This decomposes tasks into independent subtasks with file ownership, executes them in parallel, and verifies results.

### Configuration Self-Improvement

This project supports Claude Code self-improvement. **At the end of every task where something non-obvious was learned, you MUST update `AGENTS.md` (Common Gotchas) for shared findings and/or `CLAUDE.md` (Recent Learnings below) for Claude-only findings.** See `AGENTS.md` → Self-Documentation Protocol for the full rules.

When you notice repeated mistakes, recurring explanations, or opportunities for automation, also consider deeper improvements:

1. **Analyze Pattern**: Identify if it's a rule (guidance), a hook (mandatory action), a skill (workflow), or an agent (specialized task).
2. **Implement Improvement**:
   - **Rules**: Add to `AGENTS.md` (shared) or `CLAUDE.md` / `.cursor/rules/` (platform-specific) for guidance requiring judgment.
   - **Hooks**: Use `PreToolUse` or `PostToolUse` in `.claude/settings.json` for deterministic, mandatory checks.
   - **Skills**: Create new entries in `.claude/skills/` for reusable complex workflows.
   - **Agents**: Define new agents in `.claude/agents/` for specialized context isolation.
3. **Use Subagents**: For configuration research or verification, use subagents to isolate context and prevent contamination of the main session.
4. **Be Specific & Minimal**: Only add rules or skills that provide clear, non-obvious value.

Use the `/improve-claude-config` skill to orchestrate deeper changes.

### Recent Learnings

- [2026-10-02]: Content-developer rename (ADR-0036) uses preview kind `rename` and an HMAC `previewToken`. A project field rename previews full ids (`orders_status` with `model` `orders`) and `rename_project` posts the short names, because `POST /rename` looks the field up on the explore base table while `POST /rename/preview` treats those ids as full. `from` is `[a-z0-9_]+` because chart rename compiles it as a regex. The tool returns `jobId` and does not poll.
