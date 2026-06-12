#!/usr/bin/env node
/**
 * Renames duplicate Lightdash operationIds in openapi-typescript output so the
 * generated operations interface is valid TypeScript.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_TARGET = path.join(
  __dirname,
  '../packages/common/src/types/generated/openapi-types.ts',
);

/** Path-specific renames for colliding operationIds in upstream swagger. */
const PATH_OPERATION_RENAMES = [
  {
    path: '/api/v1/projects/{projectUuid}/changesets/changes/{changeUuid}/revert',
    from: 'revertChange',
    to: 'revertChangesetChange',
  },
  {
    path: '/api/v2/saved/{chartUuid}/schedulers',
    from: 'getSavedChartSchedulers',
    to: 'getSavedChartSchedulersV2',
  },
  {
    path: '/api/v2/dashboards/{dashboardUuid}/schedulers',
    from: 'getDashboardSchedulers',
    to: 'getDashboardSchedulersV2',
  },
];

function renameSecondOperationDefinition(content, from, to) {
  let seen = 0;
  return content.replace(new RegExp(`^(\\s+)${from}: \\{`, 'gm'), (match, indent) => {
    seen += 1;
    return seen === 2 ? `${indent}${to}: {` : match;
  });
}

function renamePathOperationReference(content, apiPath, from, to) {
  const escapedPath = apiPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`("${escapedPath}":[\\s\\S]*?operations\\["${from}"\\])`, 'm');
  return content.replace(pattern, (block) =>
    block.replace(`operations["${from}"]`, `operations["${to}"]`),
  );
}

function fixDuplicateOperations(content) {
  let updated = content;
  for (const { path: apiPath, from, to } of PATH_OPERATION_RENAMES) {
    updated = renamePathOperationReference(updated, apiPath, from, to);
    updated = renameSecondOperationDefinition(updated, from, to);
  }
  return updated;
}

const target = process.argv[2] ?? DEFAULT_TARGET;
const content = fs.readFileSync(target, 'utf8');
const fixed = fixDuplicateOperations(content);

if (fixed === content) {
  process.stderr.write(`No duplicate-operation fixes applied for ${target}\n`);
} else {
  fs.writeFileSync(target, fixed);
  process.stderr.write(`Fixed duplicate operations in ${target}\n`);
}
