# 9. V2 API clients for org and project role management only

Date: 2026-02-10

## Status

Accepted

## Context

The Lightdash public OpenAPI spec exposes both v1 and v2 paths. The v2 API provides endpoints for **org-level roles** (CRUD, scopes, duplicate) and **org-level and project-level role assignments** (list, assign user/group). By contrast, the organization resource (get/update org), projects (list/get/create), users (org members), groups, and space-level access exist only under v1 in the public spec. We need a clear rule for which client surfaces to implement in the HTTP client package so that we add v2 clients only where v2 endpoints exist and avoid duplicating v1 as "v2".

## Decision

We will implement v2 HTTP client modules **only** for the endpoints that exist in the OpenAPI v2 spec:

- **Org-level roles**: GET/POST org roles, GET/PATCH/DELETE role by UUID, add/remove scopes, duplicate role.
- **Org-level role assignments**: GET assignments, POST assign role to user.
- **Project-level role assignments**: GET assignments, POST/DELETE user assignment, POST/DELETE/PATCH group assignment.

Organization, projects, users, groups, and space-level access **remain on existing v1 clients** (`client.v1.organizations`, `client.v1.projects`, `client.v1.users`, `client.v1.groups`, `client.v1.projectAccess`, and spaces). We will not add v2 client methods for those domains until the public API exposes v2 endpoints for them.

## Consequences

### Positive

- **Clear version boundary**: v2 client surface matches what the v2 API actually offers; no misleading "v2" methods that call v1.
- **Single place for role management**: All org and project role operations use `client.v2.organizationRoles` and `client.v2.projectRoleAssignments`.
- **Future-proof**: When Lightdash adds v2 endpoints for org/projects/users/groups/spaces, we can add corresponding v2 client modules without conflicting with this decision.

### Negative

- **Mixed usage**: Consumers managing both roles and org/projects/users/groups will use `client.v1.*` for the latter and `client.v2.*` for roles until v2 expands; this is documented in the client and ADR.

## References

- GitHub Issue: #16
- OpenSpec: `docs/openspec/changes/client-v2-role-clients/`
- ADR-0003 (API Version Namespaces): runtime v1/v2 client instances this decision builds on
