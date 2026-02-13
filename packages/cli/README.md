# Lightdash AI CLI ([@lightdash-tools/cli](https://www.npmjs.com/package/@lightdash-tools/cli)) <!-- markdown-link-check-disable-line -->

Command-line interface for interacting with the Lightdash API.

## Installation

You can run the CLI directly without installation using `npx`:

```bash
npx @lightdash-tools/cli --help
```

Or install it globally:

```bash
npm install -g @lightdash-tools/cli
```

## Usage

### Environment Variables

The CLI requires the following environment variables (consistent with `@lightdash-tools/client`):

- `LIGHTDASH_URL` - Lightdash server base URL (e.g., `https://app.lightdash.cloud`)
- `LIGHTDASH_API_KEY` - Personal access token (PAT)
- `LIGHTDASH_PROXY_AUTHORIZATION` - Optional proxy authorization header
- `LIGHTDASH_TOOL_SAFETY_MODE` - Optional safety mode (`read-only`, `write-idempotent`, `write-destructive`)

Example:

```bash
export LIGHTDASH_URL=https://app.lightdash.cloud
export LIGHTDASH_API_KEY=your-token-here
```

### Commands

The CLI provides subcommands grouped by domain. All commands output JSON by default. If you are using `npx`, replace `lightdash-tools` with `npx @lightdash-tools/cli`.

#### Organization

```bash
lightdash-tools organization get
lightdash-tools organization-roles list
```

#### Projects

```bash
lightdash-tools projects list
lightdash-tools projects get <projectUuid>
lightdash-tools projects validate run <projectUuid>
lightdash-tools projects validate results <projectUuid>
```

#### Explores (Project-level)

```bash
lightdash-tools projects explores list <projectUuid>
lightdash-tools projects explores get <projectUuid> <exploreId>
lightdash-tools projects explores dimensions <projectUuid> <exploreId>
lightdash-tools projects explores lineage <projectUuid> <exploreId> <fieldId>
```

#### Charts (Project-level)

```bash
lightdash-tools projects charts list <projectUuid>
lightdash-tools projects charts code list <projectUuid> --ids <slugs...>
lightdash-tools projects charts code upsert <projectUuid> <slug> --file <chart.json>
```

#### Dashboards (Project-level)

```bash
lightdash-tools projects dashboards list <projectUuid>
```

#### Spaces (Project-level)

```bash
lightdash-tools projects spaces list <projectUuid>
lightdash-tools projects spaces get <projectUuid> <spaceUuid>
```

#### Users & Groups

```bash
lightdash-tools users list
lightdash-tools users get <userUuid>
lightdash-tools groups list
```

#### Metrics & Schedulers

```bash
lightdash-tools metrics list <projectUuid>
lightdash-tools metrics get <projectUuid> <tableName> <metricName>
lightdash-tools schedulers list <projectUuid>
lightdash-tools schedulers get <schedulerUuid>
```

#### Tags

```bash
lightdash-tools tags list <projectUuid>
lightdash-tools tags get <projectUuid> <tagUuid>
```

#### Query

```bash
lightdash-tools query compile <projectUuid> <exploreId> --file <query.json>
```

#### Content (Experimental)

```bash
lightdash-tools content search "query"
```

#### AI Agents

```bash
lightdash-tools ai-agents list
```

#### Access Control (Project-level)

```bash
lightdash-tools projects project-access list <projectUuid>
lightdash-tools projects project-role-assignments list <projectUuid>
```

### Help

Get help for any command:

```bash
lightdash-tools --help
lightdash-tools projects --help
lightdash-tools projects charts --help
```

## Output Format

All commands output JSON by default, formatted with 2-space indentation.

## Safety Modes

The CLI implements a hierarchical safety model to prevent accidental destructive operations. This is the same model used by the Lightdash MCP server.

### Configuration

You can control the safety mode via the `LIGHTDASH_TOOL_SAFETY_MODE` environment variable or the global `--safety-mode` flag.

- `read-only` (default): Only allows non-modifying operations (e.g., list, get).
- `write-idempotent`: Allows read operations and non-destructive writes (e.g., upsert, validate run).
- `write-destructive`: Allows all operations, including deletions.

### Enforcement

The CLI uses **Dynamic Enforcement**: all commands remain visible in help, but if you attempt to execute a command that is forbidden in the current mode, the CLI will exit with an error message.

Example:

```bash
# This will work
lightdash-tools --safety-mode read-only users list

# This will fail if delete was implemented
lightdash-tools --safety-mode read-only users delete <uuid>
```

When a command is blocked, you will see an error like:
`Error: This command is disabled in read-only mode. To enable it, use --safety-mode or set LIGHTDASH_TOOL_SAFETY_MODE.`

## Error Handling

The CLI provides helpful error messages for:

- Missing environment variables
- API errors
- Missing command arguments

## Development

If you are developing the CLI itself:

1. Install dependencies: `pnpm install`
2. Build: `pnpm build`
3. Run tests: `pnpm test`
4. Run locally: `node dist/index.js`

## License

Apache-2.0
