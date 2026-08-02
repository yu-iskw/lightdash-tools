/**
 * MCP prompts for organization-audit workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches semantic-layer prompt registration pattern */
import { z } from 'zod';

import { createPromptPlaybookEmbedder } from '../../lib/playbook-resources.js';

import {
  ORGANIZATION_AUDIT_CORE_PLAYBOOK,
  ORGANIZATION_AUDIT_HARD_BANS,
  ORGANIZATION_AUDIT_TOPIC_PLAYBOOKS,
} from './resources/playbooks.js';

import type { McpServer } from '@modelcontextprotocol/server';

const userMessages = createPromptPlaybookEmbedder({
  core: ORGANIZATION_AUDIT_CORE_PLAYBOOK,
  topics: ORGANIZATION_AUDIT_TOPIC_PLAYBOOKS,
});

export function registerOrganizationAuditPrompts(server: McpServer): void {
  server.registerPrompt(
    'audit_organization',
    {
      title: 'Audit organization',
      description: 'Evidence-backed read-only organization audit via primitive tools',
      argsSchema: {
        projectUuids: z.string().optional().describe('Comma-separated project UUIDs'),
        allowedEmailDomains: z
          .string()
          .optional()
          .describe('Comma-separated allowed email domains'),
      },
    },
    ({ projectUuids, allowedEmailDomains }) =>
      userMessages(
        `Perform an evidence-backed, read-only audit of the current Lightdash organization.

${ORGANIZATION_AUDIT_HARD_BANS}

Scope:
- Use only the organization and projects visible to the authenticated caller.
- Respect any project pin (X-Lightdash-Project).
- Optional project filter: ${projectUuids ?? '(all accessible non-preview projects up to a small cap)'}.
- Allowed email domains for delivery review: ${allowedEmailDomains ?? '(none — treat unknown domains carefully)'}.

Procedure (primitives only — there are no lightdash_audit_* tools):
1. Resolve organization identity via lightdash_get_org_profile.
2. Follow the playbook phases: identity → projects/access → content → deliveries → report.
3. Paginate list tools only while pagination.complete is false, and stop after an agreed page/project budget.
4. Synthesize findings yourself from returned evidence; distinguish facts, inferred risks, assumptions, inaccessible areas, and truncation.
5. Cite every finding with lightdash_* tool names and resource UUIDs.
6. Do not claim formal compliance certification.`,
      ),
  );

  server.registerPrompt(
    'review_access_governance',
    {
      title: 'Review access governance',
      description: 'Build an effective-access model from identity and access primitives',
      argsSchema: {},
    },
    () =>
      userMessages(
        `Review Lightdash identity and access governance.

${ORGANIZATION_AUDIT_HARD_BANS}

Use lightdash_list_org_members, lightdash_list_org_role_assignments, lightdash_list_project_roles, lightdash_list_project_direct_access, lightdash_list_space_access, and lightdash_resolve_effective_access.
Do not treat lightdash_list_project_direct_access as complete effective access.
State assumptions and coverage gaps.`,
        'access',
      ),
  );

  server.registerPrompt(
    'review_content_governance',
    {
      title: 'Review content governance',
      description: 'Inventory content health and ownership risks via list tools',
      argsSchema: {},
    },
    () =>
      userMessages(
        `Inventory charts, dashboards, and spaces; evaluate validation, ownership, and usage.

${ORGANIZATION_AUDIT_HARD_BANS}

Use lightdash_list_content, lightdash_list_validation_results, and lightdash_get_project_user_activity (plus lightdash_get_dashboard_meta when needed).
Join results in the conversation — do not assume a server-side audit tool.
Do not recommend deletion solely because content is unused.`,
        'content',
      ),
  );

  server.registerPrompt(
    'review_scheduled_deliveries',
    {
      title: 'Review scheduled deliveries',
      description: 'Inspect schedulers without executing them',
      argsSchema: {
        allowedEmailDomains: z.string().optional(),
      },
    },
    ({ allowedEmailDomains }) =>
      userMessages(
        `Inspect scheduled deliveries without creating, editing, executing, enabling, disabling, or deleting schedules.

${ORGANIZATION_AUDIT_HARD_BANS}

Allowed email domains: ${allowedEmailDomains ?? '(none provided)'}.
Use lightdash_list_project_schedulers and lightdash_get_scheduler.
Redact destinations by default. External destinations are review signals, not automatic violations.`,
        'deliveries',
      ),
  );

  server.registerPrompt(
    'investigate_audit_finding',
    {
      title: 'Investigate audit finding',
      description: 'Validate or refute one previously reported finding',
      argsSchema: {
        findingSummary: z.string().describe('The finding claim to investigate'),
      },
    },
    ({ findingSummary }) =>
      userMessages(
        `Investigate this organization-audit finding with minimum additional metadata:

${findingSummary}

${ORGANIZATION_AUDIT_HARD_BANS}

Use only primitive list/get tools. Report supporting evidence, contradictory evidence, remaining uncertainty, and whether severity/confidence changed.`,
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
