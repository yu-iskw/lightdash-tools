import { createFolderStructure } from 'eslint-plugin-project-structure';

/**
 * Lightdash Tools has a stable four-package architecture. Keep package creation
 * explicit while allowing each package to evolve internally. Unit tests remain
 * colocated; cross-module integration/e2e suites may live under tests/.
 */
export const folderStructureConfig = createFolderStructure({
  structureRoot: 'packages',
  structure: [
    { name: 'common', children: [] },
    { name: 'client', children: [] },
    { name: 'cli', children: [] },
    { name: 'mcp', children: [] },
  ],
  ignorePatterns: ['node_modules', 'dist', 'coverage', 'projectStructure.cache.json'],
});
