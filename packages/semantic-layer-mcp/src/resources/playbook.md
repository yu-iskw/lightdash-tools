# Semantic-layer MCP playbook

## Purpose

Discover the Lightdash semantic layer and **compose + compile** metric queries. Do not execute warehouse queries or mutate workspace content.

## Allowed tools

- `list_projects`, `get_project`
- Explores: `list_explores`, `get_explore`, `list_dimensions`, `get_field_lineage`
- Metrics: `list_metrics`, `get_metric`
- Catalog reads: data catalog, table metadata/analytics, metrics trees (read), filter/segment dimensions, metrics-with-time-dimensions, check metrics exist, metric owners
- `compile_query`
- `search_field_values` (warehouse **probe** — use sparingly to help build filters)

## Hard bans

Do **not** attempt or invent:

- Running metric, SQL, chart, dashboard, or underlying-data queries
- SQL runner / custom SQL
- Project validation job triggers
- Charts, dashboards, spaces, content search, tags, schedulers
- Users, groups, space ACL
- AI agents, threads, evaluations, agentops

Those tools are not on this server. Stop after a successful compile (or after reporting compile errors).

## Recommended sequence

1. Scope: `list_projects` / `get_project`
2. Discover: `list_metrics` / catalog helpers / `list_explores` — prefer search/list before a full `get_explore`
3. Optional: `search_field_values` only when filter values are needed
4. `compile_query` with `projectUuid`, `exploreId`, and `metricQuery`
5. Stop — return compiled SQL / compile result to the user

## Context tip

Keep responses small: list/search first; fetch full explore schema only for the explore you will compile against.
