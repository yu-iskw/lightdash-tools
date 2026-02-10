import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '.trunk/**'],
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
