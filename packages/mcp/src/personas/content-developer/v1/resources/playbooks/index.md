# Content-developer playbooks

URI: `lightdash://playbooks/content-developer`

Workflow-scoped playbooks (always load **core** plus one topic with a prompt):

| Topic                                          | URI                                                        |
| ---------------------------------------------- | ---------------------------------------------------------- |
| Core (gates & bans)                            | `lightdash://playbooks/content-developer/core`             |
| Dashboards & dashboard-owned charts            | `lightdash://playbooks/content-developer/dashboards`       |
| Dashboard design (layout / markdown / filters) | `lightdash://playbooks/content-developer/dashboard-design` |
| Chart types (cartesian + pie/funnel/…)         | `lightdash://playbooks/content-developer/chart-types`      |
| Content move                                   | `lightdash://playbooks/content-developer/content-move`     |

**Authoring order:** dashboard shell → charts with `dashboardSlug` → tiles. Clone via `get_chart_as_code`; never invent fieldIds or skinny `chartConfig` (cartesian series need `encode.xRef`/`yRef`). Spaces are Terraform / out-of-band (`list_spaces` / `get_space` only).
