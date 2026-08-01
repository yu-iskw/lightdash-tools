# Content-developer playbooks

URI: `lightdash://playbooks/content-developer`

Workflow-scoped playbooks (always load **core** plus one topic with a prompt):

| Topic                        | URI                                                    |
| ---------------------------- | ------------------------------------------------------ |
| Core (gates & bans)          | `lightdash://playbooks/content-developer/core`         |
| Dashboards & charts-as-tiles | `lightdash://playbooks/content-developer/dashboards`   |
| Content move                 | `lightdash://playbooks/content-developer/content-move` |

Spaces are **not** created or updated by this persona (Terraform / out-of-band). Use `list_spaces` / `get_space` to place content into existing spaces.
