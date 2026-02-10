import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      '@lightdash-ai/client': path.resolve(rootDir, 'packages/client/src/index.ts'),
      '@lightdash-ai/common': path.resolve(rootDir, 'packages/common/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.trunk'],
  },
});
