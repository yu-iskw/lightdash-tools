import { areAllProjectsAllowed } from '@lightdash-tools/common';

import { getAllowedProjectUuids } from '../config.js';

import type { TextContent } from '../tools/shared.js';

/** Defense-in-depth project allowlist for MCP handlers that parse YAML after registration. */
export function blockIfProjectNotAllowed(projectUuid: string): TextContent | undefined {
  const allowedProjects = getAllowedProjectUuids();
  if (allowedProjects.length === 0) {
    return undefined;
  }
  if (areAllProjectsAllowed(allowedProjects, [projectUuid])) {
    return undefined;
  }
  return {
    content: [
      {
        type: 'text',
        text: `Error: Project [${projectUuid}] is not in the list of allowed projects. Allowed: [${allowedProjects.join(', ')}].`,
      },
    ],
    isError: true,
  };
}
