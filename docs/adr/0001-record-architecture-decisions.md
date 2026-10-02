# 1. Record architecture decisions

Date: 2026-08-04

## Status

Accepted

## Context

We need a durable, lightweight way to record why architecturally significant choices were made so future maintainers are not forced into blind acceptance or blind reversal.

Accepted ADRs are normally immutable ([AWS ADR process](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html); [Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)): change via a new ADR that supersedes. A binding set that still taught superseded packaging (hand tool allowlists, Redis MCP store) was actively misleading AI coding agents.

## Decision

We will keep Architecture Decision Records as [described by Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions): short Markdown files with Context, Decision, Status, and Consequences. Records live under `docs/adr` and are managed with [adr-tools](https://github.com/npryce/adr-tools) when available.

An ADR documents one significant decision (structure, interfaces, safety, package boundaries, or non-obvious trade-offs). Feature changelogs, skill notes, and local implementation detail belong in package READMEs, design docs, or code—not ADRs.

**One-time rewrite (2026-08-04):** The binding set under `docs/adr` was rewritten so Decision text matches current code (profile packaging, catalog tool membership, stateless HTTP). That rewrite is a documented exception to immutability for agent clarity. **Going forward**, do not edit accepted ADRs in place — supersede with a new ADR.

New decisions append sequentially under `docs/adr`. Do not restart numbering without cause.

## Consequences

- Architectural motivation stays visible as the team and codebase change.
- The set stays small only if we keep ADR = Why; How lives elsewhere.
- Agents and humans treat `docs/adr` as current law; git history holds prior wording.
