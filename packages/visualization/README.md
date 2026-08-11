# @lightdash-tools/visualization

Pure Lightdash Visualization Specification (LVS) validators and compilers.

## Targets

- `svg` — deterministic static SVG
- `standalone-html` — self-contained HTML (dataset embed opt-in via `embedData`)
- `lightdash-custom-chart` — `{ chartConfig: { type: 'custom', config: { spec } }, metricQuery }`

## Templates (MVP)

- `metric-hero`
- `ranked-cards`

## Boundaries

- No network I/O
- Must not depend on `@lightdash-tools/client` or `@lightdash-tools/mcp`
- See [ADR-0026](../../docs/adr/0026-add-visualization-package-for-lvs-multi-target-compilers.md) and [RFC](../../docs/rfc-visualization-platform.md)

## CLI

```bash
lightdash-tools viz validate -f spec.yaml
lightdash-tools viz compile -f spec.yaml --dataset data.json --target lightdash-custom-chart
lightdash-tools viz render -f spec.yaml --dataset data.json --format svg -o out.svg
```
