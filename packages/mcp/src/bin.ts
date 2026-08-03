import { Command } from 'commander';

const program = new Command();

const PERSONA_SEMANTIC_LAYER = 'semantic-layer' as const;
const PERSONA_ORGANIZATION_AUDIT = 'organization-audit' as const;
const PERSONA_CONTENT_READER = 'content-reader' as const;
const PERSONA_CONTENT_DEVELOPER = 'content-developer' as const;
const PERSONA_CONTENT_GOVERNANCE = 'content-governance' as const;
const PERSONA_AI_AGENT_OPS = 'ai-agent-ops' as const;

type StdioPersonaId =
  | typeof PERSONA_AI_AGENT_OPS
  | typeof PERSONA_CONTENT_DEVELOPER
  | typeof PERSONA_CONTENT_GOVERNANCE
  | typeof PERSONA_CONTENT_READER
  | typeof PERSONA_ORGANIZATION_AUDIT
  | typeof PERSONA_SEMANTIC_LAYER;

function runStdio(personaId?: StdioPersonaId): void {
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
    'MCP server for Lightdash (semantic-layer, organization-audit, content-reader, content-developer, content-governance, ai-agent-ops). Default stdio persona is semantic-layer.',
  )
  .version('0.9.0');

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
  .command(PERSONA_CONTENT_READER)
  .description(
    'Run content-reader persona on stdio (saved-content discovery and bounded execution)',
  )
  .action(() => {
    runStdio(PERSONA_CONTENT_READER);
  });

program
  .command(PERSONA_CONTENT_DEVELOPER)
  .description(
    'Run content-developer persona on stdio (chart/dashboard/space authoring behind preview -> validate -> apply)',
  )
  .action(() => {
    runStdio(PERSONA_CONTENT_DEVELOPER);
  });

program
  .command(PERSONA_CONTENT_GOVERNANCE)
  .description(
    'Run content-governance persona on stdio (elicitation-gated soft-delete of charts and dashboards)',
  )
  .action(() => {
    runStdio(PERSONA_CONTENT_GOVERNANCE);
  });

program
  .command(PERSONA_AI_AGENT_OPS)
  .description('Run ai-agent-ops persona on stdio (thin AI-agent APIs and product evaluation runs)')
  .action(() => {
    runStdio(PERSONA_AI_AGENT_OPS);
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
