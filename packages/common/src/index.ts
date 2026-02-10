export function greet(name: string): string {
  return `Hello, ${name}!`;
}

// Export Lightdash API models
export * from './types/lightdash-api';
export type { LightdashApi } from './types/lightdash-api';
