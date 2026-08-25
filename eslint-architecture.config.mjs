import tsparser from '@typescript-eslint/parser';
import boundaries from 'eslint-plugin-boundaries';
import { projectStructureParser, projectStructurePlugin } from 'eslint-plugin-project-structure';

import { folderStructureConfig } from './folder-structure.mjs';

const elements = [
  { type: 'common', pattern: 'packages/common', partialMatch: false },
  { type: 'client', pattern: 'packages/client', partialMatch: false },
  { type: 'cli', pattern: 'packages/cli', partialMatch: false },
  { type: 'mcp', pattern: 'packages/mcp', partialMatch: false },
];

const dependencyPolicies = [
  {
    from: { element: { type: 'client' } },
    allow: { to: { element: { type: 'common' } } },
  },
  {
    from: { element: { type: 'cli' } },
    allow: { to: { element: { type: ['client', 'common'] } } },
  },
  {
    from: { element: { type: 'mcp' } },
    allow: { to: { element: { type: ['client', 'common'] } } },
  },
];

export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],
  },
  {
    files: ['packages/**'],
    ignores: ['projectStructure.cache.json'],
    languageOptions: { parser: projectStructureParser },
    plugins: { 'project-structure': projectStructurePlugin },
    rules: {
      'project-structure/folder-structure': ['error', folderStructureConfig],
    },
  },
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { boundaries },
    settings: {
      'boundaries/elements': elements,
      'boundaries/legacy-templates': false,
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: dependencyPolicies,
        },
      ],
    },
  },
  {
    files: ['packages/common/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@lightdash-tools/client',
            '@lightdash-tools/client/*',
            '@lightdash-tools/cli',
            '@lightdash-tools/cli/*',
            '@lightdash-tools/mcp',
            '@lightdash-tools/mcp/*',
          ],
        },
      ],
    },
  },
  {
    files: ['packages/client/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@lightdash-tools/common/*',
            '@lightdash-tools/cli',
            '@lightdash-tools/cli/*',
            '@lightdash-tools/mcp',
            '@lightdash-tools/mcp/*',
          ],
        },
      ],
    },
  },
  {
    files: ['packages/cli/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@lightdash-tools/common/*',
            '@lightdash-tools/client/*',
            '@lightdash-tools/mcp',
            '@lightdash-tools/mcp/*',
          ],
        },
      ],
    },
  },
  {
    files: ['packages/mcp/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            '@lightdash-tools/common/*',
            '@lightdash-tools/client/*',
            '@lightdash-tools/cli',
            '@lightdash-tools/cli/*',
          ],
        },
      ],
    },
  },
];
