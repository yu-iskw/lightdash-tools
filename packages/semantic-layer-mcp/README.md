# @lightdash-tools/semantic-layer-mcp (deprecated)

This package is **deprecated**. Use [`@lightdash-tools/mcp`](../mcp) instead.

| Before                                | After                                |
| ------------------------------------- | ------------------------------------ |
| `@lightdash-tools/semantic-layer-mcp` | `@lightdash-tools/mcp`               |
| Binary `lightdash-semantic-layer-mcp` | Binary `lightdash-mcp`               |
| HTTP path `/mcp`                      | Fixed path `/semantic-layer/v1/mcp`  |
| Unprefixed tool names                 | `ldt__*` (e.g. `ldt__compile_query`) |

```bash
pnpm --filter @lightdash-tools/mcp build
node packages/mcp/dist/bin.js serve-http
# Cursor url: http://localhost:8080/semantic-layer/v1/mcp
```

The `lightdash-semantic-layer-mcp` binary remains as a thin shim that prints a deprecation warning and forwards to `lightdash-mcp`.
