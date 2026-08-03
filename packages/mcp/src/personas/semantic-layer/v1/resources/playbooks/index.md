# Semantic-layer playbooks

URI: `lightdash://playbooks/semantic-layer`

Workflow-scoped playbooks (always load **core** plus one topic with a prompt):

| Topic                             | URI                                                    |
| --------------------------------- | ------------------------------------------------------ |
| Core (bans, budgets, scope, stop) | `lightdash://playbooks/semantic-layer/core`            |
| Explore / discover                | `lightdash://playbooks/semantic-layer/explore`         |
| Compose & compile                 | `lightdash://playbooks/semantic-layer/compose-compile` |

Discover the Lightdash semantic layer and **compose + compile** metric queries under default budgets. Stop after a verified compile (or clear compile errors). Do **not** run warehouse queries or mutate content.
