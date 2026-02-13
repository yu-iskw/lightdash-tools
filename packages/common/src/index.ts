export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Export safety logic
export * from './safety';

// Export Lightdash API models
export * from './types/lightdash-api';
export type { LightdashApi } from './types/lightdash-api';

// Export raw OpenAPI types for direct use (e.g., by client package)
export type { paths, components, operations } from './types/generated/openapi-types';
