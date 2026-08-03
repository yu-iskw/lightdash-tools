# Organization-audit playbooks

URI: `lightdash://playbooks/organization-audit`

Read-only evidence collection for Lightdash organization administrators. The host synthesizes findings from primitive `lightdash_*` tools — there are **no** composed `audit_*` tools and **no** compliance certification.

| Topic                        | URI                                                   | When to load                                      |
| ---------------------------- | ----------------------------------------------------- | ------------------------------------------------- |
| Core (budgets, bans, report) | `lightdash://playbooks/organization-audit/core`       | Always (embedded in every prompt)                 |
| Access governance            | `lightdash://playbooks/organization-audit/access`     | `review_access_governance` / access chapters      |
| Content and health           | `lightdash://playbooks/organization-audit/content`    | `review_content_governance` / content chapters    |
| Scheduled deliveries         | `lightdash://playbooks/organization-audit/deliveries` | `review_scheduled_deliveries` / delivery chapters |

**Live-org reality check:** organizations often have hundreds of members and many projects. Default to **bounded samples** (see core budgets). Never crawl every member page or every project unless the user explicitly expands scope.
