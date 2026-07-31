import { Command } from 'commander';

const program = new Command();

function runStdio(): void {
  void import('./index.js');
}

function runHttp(): void {
  void import('./http.js');
}

program
  .name('lightdash-mcp')
  .description('MCP server for Lightdash semantic-layer discovery and query composition')
  .version('0.6.0');

program
  .command('stdio')
  .description('Run MCP server on stdio (default)')
  .action(() => {
    runStdio();
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
