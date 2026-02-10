# 19. Project-manager must ensure issue status updates via delegation

Date: 2026-02-11

## Status

Accepted

## Context

The default GitHub Project board stays in sync with repository work only when project item **Status** (and other fields) is updated when work completes or advances. The project-manager umbrella agent routes to specialists and ensures ADR, changelog, OpenSpec, and issue work is on the project, but it did not explicitly require that status be updated when work progresses or completes. Without that requirement, items can remain in "Todo" or "In Progress" after work is done, and stakeholders see an inaccurate board.

## Decision

Project-manager **MUST** ensure that issue/project item status is updated when work tied to that item progresses or completes. It does so by **delegating** to the github-project-manager agent; project-manager must not use `gh-*` skills directly. The obligation is implemented by:

1. **Routing table**: Add a task type "Update issue/project item status when work completes or advances" that MUST be delegated to github-project-manager.
2. **Checklist**: Add a step in the "Checklist (release or major change)" to update project item status via delegation when work is complete or advanced.
3. **After Delegating**: State that when work tied to an issue completes or advances, project-manager MUST ensure the project item's status is updated by delegating to github-project-manager (which handles context verification and human approval).

## Consequences

- **Easier**: The board reflects current state; project-manager has a single, explicit responsibility to ensure status updates via delegation; no bypass of security guardrails (context verification, human approval remain in github-project-manager).
- **Ongoing**: Any workflow that completes or advances work (release, major change, or one-off ADR/changelog/OpenSpec/issue work) should trigger delegation to update status when the work is tied to a project item.

## Design (implementation spec)

All edits are in [.claude/agents/project-manager.md](../../.claude/agents/project-manager.md).

1. **Routing table** (~L45–53): Insert one row after "Issues / board sync / fields / sub-issues / add to project", before "Spec-driven work":
   - Task: **Update issue/project item status when work completes or advances**
   - Delegate to: **MUST delegate to** [github-project-manager](../../.claude/agents/github-project-manager.md)

2. **Checklist** (~L63–67): Append a step (e.g. step 5) after "Changelog when done":
   - **Update project item status**: When work is complete or advanced, delegate to github-project-manager to update the issue's Status (e.g. move to Done or In Progress as appropriate).

3. **After Delegating** (~L55–60): Extend the "For GitHub issues/projects" bullet so that when work tied to an issue completes or advances, project-manager MUST ensure the project item's status is updated by delegating to github-project-manager (which handles context verification and human approval).

## References

- GitHub: Issue #45
