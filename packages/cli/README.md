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

The CLI provides subcommands grouped by domain. All commands output JSON by default. If you are using `npx`, replace `lightdash-ai` with `npx @lightdash-tools/cli`.

#### Organization

```bash
# Get current organization details
lightdash-ai organization get

# Manage organization roles (v2)
lightdash-ai organization roles list
lightdash-ai organization roles get <roleUuid>
lightdash-ai organization roles assign <userUuid> --role <roleUuid>
```

#### Projects

```bash
# List all projects
lightdash-ai projects list

# Get specific project details
lightdash-ai projects get <projectUuid>

# Project validation
lightdash-ai projects validate run <projectUuid>
lightdash-ai projects validate results <projectUuid>

# Manage project role assignments (v2)
lightdash-ai projects roles list <projectUuid>
lightdash-ai projects roles assign --project <projectUuid> --user <userUuid> --role <roleUuid>

# Manage project access (v1)
lightdash-ai projects access list <projectUuid>
```

#### Content (Charts, Dashboards, Spaces)

```bash
# List charts in a project
lightdash-ai projects charts list <projectUuid>

# List dashboards in a project
lightdash-ai projects dashboards list <projectUuid>

# List spaces in a project
lightdash-ai projects spaces list <projectUuid>

# Search project content (v2)
lightdash-ai content search "query"
```

#### Charts as Code

```bash
# Get charts in code representation
lightdash-ai projects charts code list <projectUuid> --ids <slugs...>

# Upsert a chart from its code representation
lightdash-ai projects charts code upsert <projectUuid> <slug> --file <chart.json>
```

#### Explores (Project-level)

```bash
lightdash-ai projects explores list <projectUuid>
lightdash-ai projects explores get <projectUuid> <exploreId>
```

#### Users & Groups

```bash
# Organization members
lightdash-ai users list
lightdash-ai users get <userUuid>

# Groups
lightdash-ai groups list
lightdash-ai groups get <groupUuid>
lightdash-ai groups create "Group Name"
```

#### Metrics & Schedulers

```bash
# Metrics catalog
lightdash-ai metrics list <projectUuid>
lightdash-ai metrics get <projectUuid> <tableName> <metricName>

# Scheduled deliveries
lightdash-ai schedulers list <projectUuid>
lightdash-ai schedulers get <schedulerUuid>
```

#### Tags

```bash
lightdash-ai tags list <projectUuid>
lightdash-ai tags get <projectUuid> <tagUuid>
```

#### Query

```bash
# Compile a metric query
lightdash-ai query compile <projectUuid> <exploreId> --file <query.json>
```

#### AI Agents

```bash
# List AI agents
lightdash-ai ai-agents list

# List agent threads (admin)
lightdash-ai ai-agents threads --page 1 --page-size 10
```

### Help

Get help for any command:

```bash
lightdash-ai --help
lightdash-ai projects --help
lightdash-ai projects charts --help
lightdash-ai projects charts code --help
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
lightdash-ai --safety-mode read-only users list

# This will fail if delete was implemented
lightdash-ai --safety-mode read-only users delete <uuid>
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
