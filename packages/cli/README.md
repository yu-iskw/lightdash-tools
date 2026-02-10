# Lightdash AI CLI

Command-line interface for interacting with the Lightdash API.

## Installation

Install dependencies:

```bash
pnpm install
```

Build the CLI:

```bash
pnpm build
```

## Usage

### Environment Variables

The CLI requires the following environment variables:

- `LIGHTDASH_URL` - Lightdash server base URL (e.g., `https://app.lightdash.cloud`)
- `LIGHTDASH_API_KEY` - Personal access token (without `ldpat_` prefix)

Example:

```bash
export LIGHTDASH_URL=https://app.lightdash.cloud
export LIGHTDASH_API_KEY=your-token-here
```

### Commands

#### Organization

Get current organization:

```bash
lightdash-ai organization get
```

#### Projects

Get a project by UUID:

```bash
lightdash-ai projects get <projectUuid>
```

List all projects:

```bash
lightdash-ai projects list
```

#### Groups

List all groups in the organization:

```bash
lightdash-ai groups list
```

#### Users

List all users in the organization:

```bash
lightdash-ai users list
```

### Help

Get help for any command:

```bash
lightdash-ai --help
lightdash-ai organization --help
lightdash-ai projects --help
```

## Output Format

All commands output JSON by default, formatted with 2-space indentation.

## Error Handling

The CLI provides helpful error messages for:

- Missing environment variables
- API errors
- Missing command arguments

## Development

Run tests:

```bash
pnpm test
```

Build:

```bash
pnpm build
```

## License

ISC
