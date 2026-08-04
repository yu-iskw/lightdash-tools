/**
 * Content-developer profile: project-scoped chart/dashboard authoring (ADR-0014).
 * Hybrid authoring behind a hard preview -> validate -> apply gate; no SQL, no delete,
 * no space create/update (spaces are Terraform / out-of-band).
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';

import { registerContentDeveloperPrompts } from './prompts.js';
import { registerContentDeveloperPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const CONTENT_DEVELOPER_PROFILE_PATH = '/content-developer/v1/mcp' as const;

export const contentDeveloperProfile: ProfileDefinition = {
  id: 'content-developer',
  path: CONTENT_DEVELOPER_PROFILE_PATH,
  serverName: 'lightdash-mcp-cdev',
  mcpToolNames: listMcpToolNamesByProfile('content-developer'),
  registerPrompts: (server) => {
    registerContentDeveloperPrompts(server);
  },
  registerResources: (server) => {
    registerContentDeveloperPlaybook(server);
  },
};
