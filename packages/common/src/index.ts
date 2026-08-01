export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Export env var constants
export * from './env';

// Export safety logic
export * from './safety';

// Export input validation
export * from './input-validation';

// Export argument / descriptor validation
export * from './argument-validation';

// Export shared typed operation catalog (ADR-0013)
export * from './operations';

// Export AgentOps bundle and gate types
export * from './agentops/types';
export * from './agentops/snapshots';
export * from './agentops/formatters';
export {
  extractProjectUuidsFromToolArgs,
  hasYamlProjectDocumentArgs,
} from './agentops/extract-yaml-project';

// Export audit logger (shared by MCP and CLI)
export * from './audit';

// Curated Lightdash API types + generated OpenAPI shapes (single public path)
export * from './types';
