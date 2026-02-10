# Proposal: V2 HTTP clients for org and project role management

## Why

The Lightdash public OpenAPI spec exposes v2 endpoints for org-level roles (CRUD, scopes, duplicate) and for org-level and project-level role assignments. The client package currently exposes only `client.v2.query` for v2; there is no typed client surface for these role endpoints. We need v2 HTTP client modules so consumers can manage roles via the existing v2 HTTP client and version namespace without calling the API ad hoc.

## What Changes

- Add v2 client modules under `packages/client/src/api/v2/` for organization roles and project role assignments.
- Implement methods for: GET/POST org roles, GET/PATCH/DELETE org role by UUID, add/remove scopes, duplicate role; GET org role assignments and POST assign role to user; GET project role assignments, POST/DELETE user assignment, POST/DELETE/PATCH group assignment.
- Wire the new clients into `V2ApiClients` in `client.ts` (e.g. `client.v2.organizationRoles`, `client.v2.projectRoleAssignments`).
- No change to v1 clients or to organization, projects, users, groups, or space-level access (those remain v1-only per ADR-0009).

**NON-BREAKING**: Additive only; existing `client.v1.*` and `client.v2.query` unchanged.

## Capabilities

### New Capabilities

- `client-v2-role-clients`: The client package SHALL provide v2 HTTP client methods for org roles (list, create, get, update, delete, add scopes, remove scope, duplicate), org role assignments (list, assign user), and project role assignments (list, upsert/delete user, upsert/delete/patch group), exposed via `client.v2.organizationRoles` and `client.v2.projectRoleAssignments`.

## Impact

- **Code**: New files `api/v2/organization-roles.ts`, `api/v2/project-role-assignments.ts` and their tests; updates to `client.ts` and exports.
- **Consumers**: New optional usage `client.v2.organizationRoles.*` and `client.v2.projectRoleAssignments.*`.

## References

- ADR-0009: V2 API clients for org and project role management only
- GitHub Issue: #16
