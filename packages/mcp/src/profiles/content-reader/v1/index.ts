/**
 * Content-reader profile: saved-content discovery + bounded execution.
 */

import { listMcpToolNamesByProfile } from '@lightdash-tools/common';

import { registerContentReaderPrompts } from './prompts.js';
import { registerContentReaderPlaybook } from './resources/playbooks.js';

import type { ProfileDefinition } from '../../types.js';

export const CONTENT_READER_PROFILE_PATH = '/content-reader/v1/mcp' as const;

export const contentReaderProfile: ProfileDefinition = {
  id: 'content-reader',
  path: CONTENT_READER_PROFILE_PATH,
  serverName: 'lightdash-mcp-content',
  mcpToolNames: listMcpToolNamesByProfile('content-reader'),
  registerPrompts: (server) => {
    registerContentReaderPrompts(server);
  },
  registerResources: (server) => {
    registerContentReaderPlaybook(server);
  },
};
