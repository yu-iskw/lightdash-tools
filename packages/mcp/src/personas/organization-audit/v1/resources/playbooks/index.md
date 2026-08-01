# Organization-audit playbooks

URI: `lightdash://playbooks/organization-audit`

Workflow-scoped playbooks (always load **core** plus one topic with a prompt):

| Topic                 | URI                                                   |
| --------------------- | ----------------------------------------------------- |
| Core (gates & report) | `lightdash://playbooks/organization-audit/core`       |
| Access governance     | `lightdash://playbooks/organization-audit/access`     |
| Content and health    | `lightdash://playbooks/organization-audit/content`    |
| Scheduled deliveries  | `lightdash://playbooks/organization-audit/deliveries` |

Read-only evidence collection for Lightdash organization administrators. Findings are review signals synthesized by the host from primitive tool results — not compliance certifications. There are no composed `audit_*` MCP tools; chain bounded `lightdash_*` reads instead.
