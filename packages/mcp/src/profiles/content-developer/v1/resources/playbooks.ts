/**
 * Content-developer multi-playbook resources (core + topics + index).
 */

import { defineProfilePlaybooks } from '../../../lib/playbook-resources.js';
import type { McpServer } from '@modelcontextprotocol/server';

export type ContentDeveloperPlaybookTopic =
  | 'chart-types'
  | 'content-move'
  | 'dashboard-design'
  | 'dashboards'
  | 'recovery/dashboard-diff'
  | 'recovery/preview-required'
  | 'recovery/preview-stale'
  | 'table-calculations';

const playbooks = defineProfilePlaybooks<ContentDeveloperPlaybookTopic>({
  profileId: 'content-developer',
  moduleDir: __dirname,
  coreDescription: 'Hard bans, tools, project scope, preview gate, and apply pitfalls',
  topics: [
    {
      id: 'dashboards',
      title: 'Content-developer dashboards playbook',
      description: 'Dashboard shell first, then dashboardSlug-scoped charts as tiles',
      file: 'dashboards.md',
      useWhen: 'Creating or updating dashboard shells, tiles, or dashboardSlug-scoped charts',
      priority: 0.8,
    },
    {
      id: 'dashboard-design',
      title: 'Content-developer dashboard-design playbook',
      description:
        'Objective-first Design Spec, explore↔filter / tileTargets, layout, markdown, filters, tabs',
      file: 'dashboard-design.md',
      useWhen: 'Design Spec, layout, markdown tiles, filters, or tileTargets planning',
      priority: 0.8,
    },
    {
      id: 'chart-types',
      title: 'Content-developer chart-types playbook',
      description: 'Insight-first viz pick; cartesian encode checklist; UI intent → as-code map',
      file: 'chart-types.md',
      useWhen: 'Choosing or cloning chart types / cartesian encode',
      priority: 0.75,
    },
    {
      id: 'table-calculations',
      title: 'Content-developer table-calculations playbook',
      description:
        'metricQuery.tableCalculations: template → formula → sql; PoP, % of total, rank, windows',
      file: 'table-calculations.md',
      useWhen: 'Authoring table calculations, PoP, or window helpers',
      priority: 0.7,
    },
    {
      id: 'content-move',
      title: 'Content-developer content-move playbook',
      description: 'Move content into existing spaces (no space CRUD)',
      file: 'content-move.md',
      useWhen: 'Moving charts/dashboards into existing spaces',
      priority: 0.7,
    },
    {
      id: 'recovery/preview-stale',
      title: 'Content-developer PREVIEW_STALE recovery',
      description: 'Recover from PREVIEW_STALE (hash mismatch or baseline drift)',
      file: 'recovery/preview-stale.md',
      useWhen: 'PREVIEW_STALE',
      priority: 0.35,
    },
    {
      id: 'recovery/preview-required',
      title: 'Content-developer PREVIEW_REQUIRED recovery',
      description: 'Recover when preview token is missing, invalid, or expired',
      file: 'recovery/preview-required.md',
      useWhen: 'PREVIEW_REQUIRED',
      priority: 0.35,
    },
    {
      id: 'recovery/dashboard-diff',
      title: 'Content-developer dashboard diff recovery',
      description: 'Interpret dashboard preview diff.removed noise vs real omissions',
      file: 'recovery/dashboard-diff.md',
      useWhen: 'Dashboard preview diff.removed / tiles-tabs-filters omissions',
      priority: 0.35,
    },
  ],
});

export { CONTENT_DEVELOPER_HARD_BANS } from '../invariants.js';
export const getAllPlaybookMarkdown = playbooks.getAllPlaybookMarkdown;
export const CONTENT_DEVELOPER_CORE_PLAYBOOK = playbooks.CORE_PLAYBOOK;
export const CONTENT_DEVELOPER_TOPIC_PLAYBOOKS = playbooks.TOPIC_PLAYBOOKS;
export const CONTENT_DEVELOPER_TOPIC_META = playbooks.TOPIC_META;

export function registerContentDeveloperPlaybook(server: McpServer): void {
  playbooks.registerPlaybooks(server);
}
