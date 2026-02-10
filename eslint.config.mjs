import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  // Incremental recommended-plus (ADR-0016): consistent types, promises, no explicit any
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        allowDefaultProject: ['scripts/**/*.mjs'],
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '.trunk/**',
      '.claude/**',
      'vitest.config.ts',
    ],
  },
  // Node scripts: process is a global
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly' } },
  },
  // Common package types: namespaces used by design (ADR-0008, LightdashApi)
  {
    files: ['packages/common/src/types/**/*.ts'],
    rules: { '@typescript-eslint/no-namespace': 'off' },
  },
  // Type barrel files: imports used only in type re-exports (e.g. export type X = Y.Z)
  {
    files: ['packages/common/src/types/v1/index.ts', 'packages/common/src/types/v2/index.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
);
