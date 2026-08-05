# ADR-0023: Request-scoped MCP operation notifications

- Status: Proposed
- Date: 2026-08-05

## Context

MCP clients should be able to observe meaningful progress while Lightdash tools execute. The MCP progress protocol is request-scoped: clients opt in by attaching a progress token, after which the server may emit `notifications/progress` messages.

Directly coupling the reusable Lightdash client to MCP would make package boundaries harder to maintain and would not help CLI or telemetry consumers.

## Decision

Introduce a transport-neutral `OperationReporter` in the MCP package and expose it through `ToolExecutionContext`.

The MCP adapter:

- reads the request progress token;
- emits monotonic `notifications/progress` messages;
- degrades to a no-op when no token is supplied;
- treats notification delivery as best-effort;
- never exposes raw URLs, SQL, credentials, headers, or response bodies.

Tools using `wrapToolContextual` may report semantic phases such as `preparing`, `calling-service`, `waiting`, `processing-response`, and `completed`.

## Consequences

- Existing tools remain source-compatible unless they construct `ToolExecutionContext` directly.
- Simple tools using `wrapTool` continue unchanged.
- Contextual tools can adopt progress incrementally.
- MCP transport details remain outside `@lightdash-tools/client`.
- Clients that do not support progress continue to receive normal tool results.

## Follow-up

Instrument selected long-running tools first, measure client rendering behavior, and then decide whether to add Lightdash HTTP observer hooks and OpenTelemetry adapters.
