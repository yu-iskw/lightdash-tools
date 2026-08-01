import { Command } from 'commander';

const program = new Command();

const PERSONA_SEMANTIC_LAYER = 'semantic-layer' as const;
const PERSONA_ORGANIZATION_AUDIT = 'organization-audit' as const;

function runStdio(
  personaId?: typeof PERSONA_ORGANIZATION_AUDIT | typeof PERSONA_SEMANTIC_LAYER,
): void {
  if (personaId) {
    process.env.LIGHTDASH_TOOLS_MCP_STDIO_PERSONA = personaId;
  }
  void import('./index.js');
}

function runHttp(): void {
  void import('./http.js');
}

program
  .name('lightdash-mcp')
  .description(
    'MCP server for Lightdash (semantic-layer discovery and organization-audit). Default stdio persona is semantic-layer.',
  )
  .version('0.7.0');

program
  .command('stdio')
  .description('Run MCP server on stdio with the default semantic-layer persona')
  .action(() => {
    runStdio(PERSONA_SEMANTIC_LAYER);
  });

program
  .command(PERSONA_SEMANTIC_LAYER)
  .description('Run semantic-layer persona on stdio')
  .action(() => {
    runStdio(PERSONA_SEMANTIC_LAYER);
  });

program
  .command(PERSONA_ORGANIZATION_AUDIT)
  .description('Run organization-audit persona on stdio (read-only org governance)')
  .action(() => {
    runStdio(PERSONA_ORGANIZATION_AUDIT);
  });

program
  .command('serve-http')
  .description(
    'Run MCP server with Streamable HTTP transport (auth inferred from OAuth client credentials, shared-key, or NODE_ENV=development)',
  )
  .action(() => {
    runHttp();
  });

program
  .option('--http', 'Run as HTTP server instead of Stdio (alias for serve-http)')
  .action((options) => {
    if (options.http) {
      runHttp();
    } else {
      runStdio();
    }
  });

program.parse(process.argv);
