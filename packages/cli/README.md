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
```

#### Projects

```bash
lightdash-tools projects list
lightdash-tools projects get <projectUuid>
```

#### Explores

```bash
lightdash-tools explores list <projectUuid>
lightdash-tools explores get <projectUuid> <exploreId>
```

#### Charts

```bash
lightdash-tools charts list <projectUuid>
lightdash-tools charts get-code <projectUuid> --ids <slugs...>
lightdash-tools charts upsert-code <projectUuid> <slug> --file <chart.json>
```

#### Dashboards

```bash
lightdash-tools dashboards list <projectUuid>
```

#### Spaces

```bash
lightdash-tools spaces list <projectUuid>
lightdash-tools spaces get <projectUuid> <spaceUuid>
```

#### Groups

```bash
lightdash-tools groups list
```

#### Users

```bash
lightdash-tools users list
```

#### Metrics

```bash
lightdash-tools metrics list <projectUuid>
```

#### Schedulers

```bash
lightdash-tools schedulers list <projectUuid>
```

#### Tags

```bash
lightdash-tools tags list <projectUuid>
```

#### Content (Experimental)

```bash
lightdash-tools content search "query"
```

#### AI Agents

```bash
lightdash-tools ai-agents list
```

#### Project Access

```bash
lightdash-tools project-access list <projectUuid>
```

#### Organization Roles

```bash
lightdash-tools organization-roles list
```

#### Project Role Assignments

```bash
lightdash-tools project-role-assignments list <projectUuid>
```

#### Query

```bash
lightdash-tools query compile <projectUuid> <exploreId> --file <query.json>
```

### Help

Get help for any command:

```bash
lightdash-tools --help
lightdash-tools projects --help
lightdash-tools charts --help
```

## Output Format

All commands output JSON by default, formatted with 2-space indentation.

## Safety Modes

The CLI implements a hierarchical safety model to prevent accidental destructive operations. You can control this via the `LIGHTDASH_TOOL_SAFETY_MODE` environment variable or the global `--mode` flag.

- `read-only`: Only allows non-modifying operations (e.g., list, get).
- `write-idempotent`: Allows read operations and non-destructive writes (e.g., upsert).
- `write-destructive` (default): Allows all operations, including deletions.

Example:

```bash
lightdash-tools --mode read-only users list
```

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
4. Run locally: `node dist/index.jst`

## License

Apache-2.0
