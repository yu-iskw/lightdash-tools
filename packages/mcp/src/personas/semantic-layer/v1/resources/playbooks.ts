/**
 * Semantic-layer multi-playbook resources (core + topics + index).
 */

import { definePersonaPlaybooks } from '../../../lib/playbook-resources.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type SemanticLayerPlaybookTopic = 'compose-compile' | 'explore';

const playbooks = definePersonaPlaybooks<SemanticLayerPlaybookTopic>({
  personaId: 'semantic-layer',
  moduleDir: __dirname,
  /** Shared hard-ban text for prompts (keep in sync with playbooks/core.md Hard bans section). */
  hardBans:
    'Do not run metric/SQL/chart queries, use SQL runner, trigger validation jobs, mutate content, or call AI/identity tools. Those are not available on this server.',
  coreDescription: 'Hard bans, allowed tools, project scope, and stop criteria',
  topics: [
    {
      id: 'explore',
      title: 'Semantic-layer explore playbook',
      description: 'Explore discovery, disambiguation, and field shortlisting',
      file: 'explore.md',
    },
    {
      id: 'compose-compile',
      title: 'Semantic-layer compose/compile playbook',
      description: 'Compose metric queries and compile without warehouse execution',
      file: 'compose-compile.md',
    },
  ],
});

export const SEMANTIC_LAYER_CORE_URI = playbooks.URIs.core;
export const SEMANTIC_LAYER_EXPLORE_URI = playbooks.URIs.topics.explore;
export const SEMANTIC_LAYER_COMPOSE_COMPILE_URI = playbooks.URIs.topics['compose-compile'];
export const SEMANTIC_LAYER_HARD_BANS = playbooks.HARD_BANS;
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const SEMANTIC_LAYER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const SEMANTIC_LAYER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;

export function registerSemanticLayerPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
