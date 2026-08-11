import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

import { GLOBAL_THRESHOLDS } from './coverage-thresholds.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname);

export default defineConfig({
  resolve: {
    alias: {
      '@lightdash-tools/client': path.resolve(rootDir, 'packages/client/src/index.ts'),
      '@lightdash-tools/common': path.resolve(rootDir, 'packages/common/src/index.ts'),
      '@lightdash-tools/visualization': path.resolve(
        rootDir,
        'packages/visualization/src/index.ts',
      ),
    },
  },
  test: {
    include: ['packages/*/src/**/*.{test,spec}.ts'],
    exclude: ['node_modules', '.trunk'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.generated.ts',
        'packages/common/src/types/generated/**',
        'packages/common/src/types/v1/index.ts',
        'packages/common/src/types/v2/index.ts',
        // Process entrypoints and orchestration layers covered by integration tests / common pure logic.
        'packages/mcp/src/bin.ts',
        'packages/mcp/src/index.ts',
        'packages/mcp/src/http.ts',
        'packages/cli/src/index.ts',
        'packages/cli/src/commands/agentops/**',
      ],
      thresholds: GLOBAL_THRESHOLDS,
    },
  },
});
