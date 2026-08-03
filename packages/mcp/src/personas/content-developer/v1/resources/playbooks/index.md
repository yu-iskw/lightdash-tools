# Content-developer playbooks

URI: `lightdash://playbooks/content-developer`

Workflow-scoped playbooks (always load **core** plus one topic with a prompt):

| Topic                                                        | URI                                                        |
| ------------------------------------------------------------ | ---------------------------------------------------------- |
| Core (gates & bans)                                          | `lightdash://playbooks/content-developer/core`             |
| Dashboards & dashboard-owned charts                          | `lightdash://playbooks/content-developer/dashboards`       |
| Dashboard design (Design Spec + layout / markdown / filters) | `lightdash://playbooks/content-developer/dashboard-design` |
| Chart types (cartesian + pie/funnel/…)                       | `lightdash://playbooks/content-developer/chart-types`      |
| Content move                                                 | `lightdash://playbooks/content-developer/content-move`     |

**Authoring order:** clarify Objective → Design Spec → approve → dashboard shell → charts with `dashboardSlug` → tiles (+ optional filters; prefer one explore or `tileTargets` exclude by tile UUID). Clone via `get_chart_as_code`; never invent fieldIds or skinny `chartConfig` (cartesian series need `encode.xRef`/`yRef`). Multi-viz / all chart types only when the user explicitly asks. Cap concurrent writes at ≤2 on hosted tunnels. Spaces are Terraform / out-of-band (`list_spaces` / `get_space` only).
