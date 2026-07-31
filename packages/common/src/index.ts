export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Export env var constants
export * from './env';

// Export safety logic
export * from './safety';

// Export input validation
export * from './input-validation';

// Export argument / descriptor validation (RFC Phase 0)
export * from './argument-validation';

// Export shared typed operation registry (RFC Section 7)
export * from './operations';

// Export AgentOps bundle and gate types (RFC Phase 2)
export * from './agentops/types';
export * from './agentops/snapshots';
export * from './agentops/formatters';
export {
  extractProjectUuidsFromToolArgs,
  hasYamlProjectDocumentArgs,
} from './agentops/extract-yaml-project';

// Export audit logger (shared by MCP and CLI)
export * from './audit';

// Export Lightdash API models
export * from './types/lightdash-api';
export { CONTENT_SORT_BY_COLUMNS } from './types/v2/content';

// Export raw OpenAPI types for direct use (e.g., by client package)
export type { paths, components, operations } from './types/generated/openapi-types';
