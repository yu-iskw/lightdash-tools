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

// Export audit logger (shared by MCP and CLI)
export * from './audit';

// Export Lightdash API models
export * from './types/lightdash-api';

// Export raw OpenAPI types for direct use (e.g., by client package)
export type { paths, components, operations } from './types/generated/openapi-types';
