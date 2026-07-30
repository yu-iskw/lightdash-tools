import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import eslintCommentsPlugin from '@eslint-community/eslint-plugin-eslint-comments';
import { flatConfigs as importXFlatConfigs } from 'eslint-plugin-import-x';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import vitestPlugin from '@vitest/eslint-plugin';

const repoRoot = import.meta.dirname;

/** @type {import("@typescript-eslint/parser").ParserOptions} */
const tsParserOptions = {
  ecmaVersion: 2022,
  sourceType: 'module',
  projectService: {
    allowDefaultProject: [
      'scripts/check-common-no-client.mjs',
      'scripts/validate-package-names.mjs',
    ],
  },
  tsconfigRootDir: repoRoot,
};

/** Flat-config fragment from eslint-plugin-security (code-level patterns; complements Trivy/OSV). */
const securityRecommended = security.configs.recommended;

const importXPlugins = {
  ...importXFlatConfigs.recommended.plugins,
  ...importXFlatConfigs.typescript.plugins,
};

const importXSettings = {
  ...importXFlatConfigs.typescript.settings,
  'import-x/resolver': {
    typescript: {
      alwaysTryTypes: true,
      project: ['packages/*/tsconfig.json'],
    },
    node: true,
  },
};

const importXRules = {
  ...importXFlatConfigs.recommended.rules,
  ...importXFlatConfigs.typescript.rules,
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      pathGroupsExcludedImportTypes: ['type'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],
  'import-x/no-cycle': ['error', { maxDepth: 3 }],
  // import-x does not understand the MCP SDK wildcard ESM exports with .js subpaths.
  'import-x/no-unresolved': [
    'error',
    {
      ignore: ['^@modelcontextprotocol/(server|node|client|core)(/|$)', '\\.js$'],
    },
  ],
};

/**
 * Shared production + test rules (AI agent feedback).
 * Cyclomatic: only SonarJS (core `complexity` removed — duplicated sonarjs/cyclomatic-complexity).
 * Cognitive: sonarjs/cognitive-complexity (primary “hard to change” signal).
 * Structural: max-depth / max-params / max-nested-callbacks (catch wide APIs / deep nesting).
 */
const sharedTsRules = Object.assign({}, tseslint.configs.recommended.rules, {
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: true } }],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    // inline-type-imports keeps one import per module (import-x/no-duplicates).
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/explicit-module-boundary-types': 'error',
  '@typescript-eslint/sort-type-constituents': 'error',
  // Security (core + plugin; Trunk still runs Trivy/OSV)
  'no-eval': 'error',
  'no-implied-eval': 'error',
  'no-new-func': 'error',
  'prefer-const': 'error',
  'max-lines-per-function': ['error', { max: 280 }],
  'max-depth': ['error', { max: 5 }],
  'max-params': ['error', { max: 5 }],
  'max-nested-callbacks': ['error', { max: 2 }],
  'sonarjs/cyclomatic-complexity': ['error', { threshold: 12 }],
  'sonarjs/cognitive-complexity': ['error', 12],
  'sonarjs/no-duplicate-string': 'error',
  'sonarjs/prefer-immediate-return': 'error',
  'no-unreachable': 'error',
});

const unicornFilenameCase = [
  'error',
  {
    cases: { kebabCase: true, pascalCase: true },
    ignore: [/^[\w-]+\.test\.ts$/],
  },
];

const tsProductionPlugins = {
  ...importXPlugins,
  ...securityRecommended.plugins,
  '@typescript-eslint': tseslint,
  sonarjs,
  unicorn,
};

const tsProductionRules = {
  ...importXRules,
  ...securityRecommended.rules,
  ...sharedTsRules,
  '@typescript-eslint/no-unused-private-class-members': 'error',
  'unicorn/filename-case': unicornFilenameCase,
};

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.claude/**',
      '.cursor/**',
      '.trunk/**',
      '**/*.generated.ts',
      'packages/common/src/types/generated/**',
      '**/vitest.config.ts',
      'vitest.config.ts',
    ],
  },
  {
    plugins: {
      'eslint-comments': eslintCommentsPlugin,
    },
    rules: {
      'eslint-comments/no-unused-disable': 'error',
      'eslint-comments/disable-enable-pair': 'error',
    },
  },
  {
    files: ['packages/**/*.ts'],
    ignores: ['**/dist/**', '**/*.test.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: tsParserOptions,
    },
    plugins: tsProductionPlugins,
    settings: importXSettings,
    rules: tsProductionRules,
  },
  {
    files: ['packages/**/*.tsx'],
    ignores: ['**/dist/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ...tsParserOptions,
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: tsProductionPlugins,
    settings: importXSettings,
    rules: {
      ...tsProductionRules,
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'import-x/default': 'off',
    },
  },
  {
    files: ['packages/**/*.test.ts'],
    ignores: ['**/dist/**'],
    languageOptions: {
      parser: tsparser,
      parserOptions: tsParserOptions,
      globals: vitestPlugin.environments.env.globals,
    },
    plugins: {
      ...tsProductionPlugins,
      ...vitestPlugin.configs.recommended.plugins,
    },
    settings: importXSettings,
    rules: {
      ...tsProductionRules,
      ...vitestPlugin.configs.recommended.rules,
      // Tests often repeat string literals and use conditional expects; keep signal without noise.
      'vitest/no-conditional-expect': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'max-lines-per-function': ['error', { max: 700 }],
      'max-nested-callbacks': 'off',
    },
  },
  // Common package types: namespaces used by design (ADR-0008, LightdashApi)
  {
    files: ['packages/common/src/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  // Type barrel files: imports used only in type re-exports (e.g. export type X = Y.Z)
  {
    files: ['packages/common/src/types/v1/index.ts', 'packages/common/src/types/v2/index.ts'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  // Enforce no deprecated API calls in CLI and MCP (ADR-0036)
  {
    files: [
      'packages/cli/src/**/*.ts',
      'packages/mcp/src/**/*.ts',
      'packages/semantic-layer-mcp/src/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-deprecated': 'error',
    },
  },
  // Commander/MCP registration uses unavoidable three-level callback nesting.
  {
    files: ['packages/cli/src/commands/**/*.ts', 'packages/mcp/src/tools/**/*.ts'],
    rules: {
      'max-nested-callbacks': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  // RFC AgentOps orchestration: declarative reconcile and gate workflows are branch-heavy by design.
  {
    files: [
      'packages/cli/src/commands/agentops/**/*.ts',
      'packages/client/src/agentops/**/*.ts',
      'packages/cli/src/commands/agents-evals.ts',
      'packages/cli/src/commands/agents-crud.ts',
      'packages/cli/src/utils/file-input.ts',
      'packages/common/src/agentops/types.ts',
      'packages/mcp/src/tools/agentops.ts',
      'packages/mcp/src/tasks/memory-store.ts',
    ],
    rules: {
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/cyclomatic-complexity': 'off',
      'max-lines-per-function': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
    },
  },
  // Guardrail helpers use dynamic key lookup by design (ADR-0034).
  {
    files: [
      'packages/common/src/safety.ts',
      'packages/cli/src/utils/safety.ts',
      'packages/client/src/utils/env.ts',
      'packages/cli/src/commands/schema.ts',
      'packages/client/src/api/v1/explores.ts',
      '**/*.test.ts',
    ],
    rules: {
      'security/detect-object-injection': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/cyclomatic-complexity': 'off',
      'max-depth': 'off',
    },
  },
  {
    files: [
      'packages/cli/src/commands/charts.ts',
      'packages/cli/src/commands/query.ts',
      'packages/common/src/audit.ts',
    ],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
      },
    },
    plugins: {
      ...securityRecommended.plugins,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
