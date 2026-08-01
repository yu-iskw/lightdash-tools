/**
 * MCP prompts for content-governance soft-delete workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches content-reader prompt registration pattern */
import { z } from 'zod';

import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  CONTENT_GOVERNANCE_CORE_PLAYBOOK,
  CONTENT_GOVERNANCE_HARD_BANS,
  CONTENT_GOVERNANCE_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { ContentGovernancePlaybookTopic } from './resources/playbooks.js';
import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: CONTENT_GOVERNANCE_CORE_PLAYBOOK,
  topics: CONTENT_GOVERNANCE_TOPIC_PLAYBOOKS,
});

const TOPIC_CHARTS = 'charts' as const satisfies ContentGovernancePlaybookTopic;
const TOPIC_DASHBOARDS = 'dashboards' as const satisfies ContentGovernancePlaybookTopic;

const ELICITATION_RULES = `Hard rule: form elicitation only. Call the matching lightdash_delete_* tool;
the human must accept a form with decision=confirm_delete and confirmationText equal to the exact
resource name. Never invent confirmation flags or treat chat approval as sufficient.
If the client lacks form elicitation, expect ELICITATION_REQUIRED and stop.
If the resource drifts after binding, expect RESOURCE_CHANGED and re-invoke the tool.`;

export function registerContentGovernancePrompts(server: McpServer): void {
  server.registerPrompt(
    'delete_chart',
    {
      title: 'Soft-delete chart',
      description:
        'Soft-delete a saved chart after form elicitation (restorable from trash; no permanent purge)',
      argsSchema: {
        chartUuidOrSlug: z.string(),
        reason: z.string().optional(),
      },
    },
    ({ chartUuidOrSlug, reason }) =>
      userMessages(
        `Soft-delete the Lightdash chart ${chartUuidOrSlug}.

${CONTENT_GOVERNANCE_HARD_BANS}

${ELICITATION_RULES}

Reason / context: ${reason ?? '(none provided)'}.
Resolve project scope (pin / LIGHTDASH_TOOLS_PROJECT_UUID / projectUuid), then call
lightdash_delete_chart with chartUuidOrSlug.
Complete human form fields: decision (confirm_delete | do_not_delete) and confirmationText
(exact chart name). Report the deletion receipt or that nothing was deleted if declined/cancelled.
Do not permanently purge.`,
        TOPIC_CHARTS,
      ),
  );

  server.registerPrompt(
    'delete_dashboard',
    {
      title: 'Soft-delete dashboard',
      description:
        'Soft-delete a dashboard after form elicitation (restorable from trash; no permanent purge)',
      argsSchema: {
        dashboardUuidOrSlug: z.string(),
        reason: z.string().optional(),
      },
    },
    ({ dashboardUuidOrSlug, reason }) =>
      userMessages(
        `Soft-delete the Lightdash dashboard ${dashboardUuidOrSlug}.

${CONTENT_GOVERNANCE_HARD_BANS}

${ELICITATION_RULES}

Reason / context: ${reason ?? '(none provided)'}.
Resolve project scope (pin / LIGHTDASH_TOOLS_PROJECT_UUID / projectUuid), then call
lightdash_delete_dashboard with dashboardUuidOrSlug.
Complete human form fields: decision (confirm_delete | do_not_delete) and confirmationText
(exact dashboard name). Report the deletion receipt or that nothing was deleted if declined/cancelled.
Do not permanently purge, delete spaces, or bulk-delete.`,
        TOPIC_DASHBOARDS,
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
