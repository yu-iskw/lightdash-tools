/**
 * Semantic-layer multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';

import { SEMANTIC_LAYER_HARD_BANS } from '../invariants.js';

import type { McpServer } from '@modelcontextprotocol/server';

export type SemanticLayerPlaybookTopic = 'compose-compile' | 'explore';

const playbooks = defineProfilePlaybooks<SemanticLayerPlaybookTopic>({
  profileId: 'semantic-layer',
  moduleDir: __dirname,
  hardBans: SEMANTIC_LAYER_HARD_BANS,
  coreDescription: 'Hard bans, budgets, allowed tools, project scope, and stop criteria',
  topics: [
    {
      id: 'explore',
      title: 'Semantic-layer explore playbook',
      description: 'Explore discovery, disambiguation, and field shortlisting',
      file: 'explore.md',
      useWhen: 'Discovering explores, metrics, and dimensions for a question',
      priority: 0.8,
    },
    {
      id: 'compose-compile',
      title: 'Semantic-layer compose/compile playbook',
      description: 'Compose metric queries and compile without warehouse execution',
      file: 'compose-compile.md',
      useWhen: 'Composing or debugging a metric query compile',
      priority: 0.75,
    },
  ],
});

export { SEMANTIC_LAYER_HARD_BANS };
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const SEMANTIC_LAYER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const SEMANTIC_LAYER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const SEMANTIC_LAYER_TOPIC_META = playbooks.TOPIC_META;

export function registerSemanticLayerPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
