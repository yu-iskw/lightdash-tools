# Organization-audit — scheduled deliveries

URI: `lightdash://playbooks/organization-audit/deliveries`

## Phase 4 — Deliveries

Per project (capped): `list_project_schedulers` (destinations redacted by default; pass `revealDestinations` only when required). Use `get_scheduler` with `projectUuid` + `schedulerUuid` for one schedule. Pass `allowedEmailDomains` when reviewing external email destinations.

Inspect scheduled deliveries without creating, editing, executing, enabling, disabling, or deleting schedules. Redact destinations by default. External destinations are review signals, not automatic violations.
