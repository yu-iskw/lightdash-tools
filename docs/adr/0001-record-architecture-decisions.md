# 1. Record architecture decisions

Date: 2026-07-31

## Status

Accepted

## Context

We need a durable, lightweight way to record why architecturally significant choices were made so future maintainers are not forced into blind acceptance or blind reversal.

## Decision

We will keep Architecture Decision Records as [described by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): short Markdown files with Context, Decision, Status, and Consequences. Records live under `docs/adr` and are managed with [adr-tools](https://github.com/npryce/adr-tools) when available.

An ADR documents one significant decision (structure, interfaces, safety, package boundaries, or non-obvious trade-offs). Feature changelogs, skill notes, and local implementation detail belong in package READMEs, design docs, or code—not ADRs.

When a decision changes, we supersede the old record rather than rewriting history in place.

## Consequences

- Architectural motivation stays visible as the team and codebase change.
- The set stays small only if we keep ADR = Why; How lives elsewhere.
- After this slim rewrite, new decisions append sequentially; we do not restart numbering again without cause.
