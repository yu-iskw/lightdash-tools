#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

function runStdio(): void {
  void import('./index.js');
}

function runHttp(): void {
  void import('./http.js');
}

program
  .name('lightdash-semantic-layer-mcp')
  .description('MCP server for Lightdash semantic-layer discovery and compile-only workflows')
  .version('0.6.0')
  .action(() => {
    runStdio();
  });

program
  .command('stdio')
  .description('Run MCP server on stdio (default)')
  .action(() => {
    runStdio();
  });

program
  .command('serve-http')
  .description('Run MCP server on Streamable HTTP (auth: none+PAT or lightdash-oauth)')
  .action(() => {
    runHttp();
  });

program.parse(process.argv);
