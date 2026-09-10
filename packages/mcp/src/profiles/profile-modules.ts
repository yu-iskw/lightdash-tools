/**
 * Sync profile-module load for Commander help (CJS dist only).
 * HTTP/stdio preload uses dynamic import() in index.ts (Vitest-friendly).
 */

import type { ProfileDefinition, ProfileId } from './types.js';

/* eslint-disable @typescript-eslint/no-require-imports -- CJS sync help inventory */

/** Load one profile definition synchronously (dist/bin help path). */
export function loadProfileModuleSync(id: ProfileId): ProfileDefinition {
  switch (id) {
    case 'semantic-layer':
      return require('./semantic-layer/v1/index.js').semanticLayerProfile as ProfileDefinition;
    case 'organization-audit':
      return require('./organization-audit/v1/index.js')
        .organizationAuditProfile as ProfileDefinition;
    case 'content-reader':
      return require('./content-reader/v1/index.js').contentReaderProfile as ProfileDefinition;
    case 'content-developer':
      return require('./content-developer/v1/index.js')
        .contentDeveloperProfile as ProfileDefinition;
    case 'content-governance':
      return require('./content-governance/v1/index.js')
        .contentGovernanceProfile as ProfileDefinition;
    case 'ai-agent-chat':
      return require('./ai-agent-chat/v1/index.js').aiAgentChatProfile as ProfileDefinition;
    case 'ai-agent-ops':
      return require('./ai-agent-ops/v1/index.js').aiAgentOpsProfile as ProfileDefinition;
    case 'data-analyst':
      return require('./data-analyst/v1/index.js').dataAnalystProfile as ProfileDefinition;
    default: {
      const _exhaustive: never = id;
      throw new Error(`Unknown profile id: ${String(_exhaustive)}`);
    }
  }
}

/* eslint-enable @typescript-eslint/no-require-imports */
