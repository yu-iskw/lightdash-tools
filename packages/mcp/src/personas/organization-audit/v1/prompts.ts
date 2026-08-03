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
      description:
        'Bounded, evidence-backed read-only org audit via primitive lightdash_* tools (no audit_* mega-tools)',
      argsSchema: {
        projectUuids: z
          .string()
          .optional()
          .describe(
            'Comma-separated project UUIDs to deep-dive (default: up to 3 non-preview projects, or HTTP pin)',
          ),
        allowedEmailDomains: z
          .string()
          .optional()
          .describe('Comma-separated internal email domains; convert to a string[] for tool args'),
      },
    },
    ({ projectUuids, allowedEmailDomains }) =>
      userMessages(
        `Perform a bounded, evidence-backed, read-only audit of the current Lightdash organization.

${ORGANIZATION_AUDIT_HARD_BANS}

Scope inputs:
- Optional project filter: ${projectUuids ?? '(none — sample ≤3 DEFAULT non-preview projects; honor X-Lightdash-Project pin if set)'}.
- Allowed email domains: ${allowedEmailDomains ?? '(none — convert to [] ; treat unknown domains carefully)'}.
- Split comma-separated args into arrays before calling tools.

Procedure (primitives only — there are no lightdash_audit_* tools):
1. Phase 0 (core): get_org_profile → list_org_projects → choose projects under budgets.
2. Access (access playbook): members/groups sample → per project: list_project_roles → list_project_direct_access → list_space_access → resolve_effective_access (bounded). Empty direct_access is normal with group/org grants.
3. Content (content playbook): per project list_content + list_validation_results + get_project_user_activity (summarize; do not dump weekly series).
4. Deliveries (deliveries playbook): list_project_schedulers; get_scheduler only as needed.
5. Phase 5 report: use the core finding template; cite tools + UUIDs; separate facts vs inferences; list budget/pagination/redaction gaps.
6. Never claim formal compliance certification or exhaustive inventory when pagination/budgets stopped early.`,
      ),
  );

  server.registerPrompt(
    'review_access_governance',
    {
      title: 'Review access governance',
      description:
        'Build a bounded effective-access picture from identity + project/space primitives',
      argsSchema: {
        projectUuids: z
          .string()
          .optional()
          .describe('Comma-separated project UUIDs (default: ≤3 sampled projects)'),
        allowedEmailDomains: z
          .string()
          .optional()
          .describe('Comma-separated domains → string[] for tools'),
      },
    },
    ({ projectUuids, allowedEmailDomains }) =>
      userMessages(
        `Review Lightdash identity and access governance with core budgets.

${ORGANIZATION_AUDIT_HARD_BANS}

Projects: ${projectUuids ?? '(sample ≤3)'}.
Domains: ${allowedEmailDomains ?? '(none)'}.

Mandatory tool order per project: lightdash_list_project_roles → lightdash_list_project_direct_access → lightdash_list_space_access → lightdash_resolve_effective_access.
Also use lightdash_list_org_members, lightdash_list_org_groups, lightdash_list_org_role_assignments, lightdash_list_custom_roles as needed.
Empty direct_access ≠ no access. Truncation / INCOMPLETE_EFFECTIVE_ACCESS warnings must appear in the report.`,
        'access',
      ),
  );

  server.registerPrompt(
    'review_content_governance',
    {
      title: 'Review content governance',
      description:
        'Inventory content health via list_content, validation, and user-activity evidence',
      argsSchema: {
        projectUuids: z
          .string()
          .optional()
          .describe(
            'Comma-separated project UUIDs (required for useful inventory; else sample ≤3)',
          ),
      },
    },
    ({ projectUuids }) =>
      userMessages(
        `Inventory charts, dashboards, and spaces; evaluate validation, ownership, and usage.

${ORGANIZATION_AUDIT_HARD_BANS}

Projects: ${projectUuids ?? '(sample ≤3; always pass projectUuids into list_content)'}.

Use lightdash_list_content (sortBy views or last_updated_at), lightdash_list_validation_results, and lightdash_get_project_user_activity (summarize role counts + top views only). Optional lightdash_get_dashboard_meta.
Join in the conversation — no server-side audit crawler. Do not recommend deletion for low/zero views.`,
        'content',
      ),
  );

  server.registerPrompt(
    'review_scheduled_deliveries',
    {
      title: 'Review scheduled deliveries',
      description: 'Inspect schedulers without executing or mutating them',
      argsSchema: {
        projectUuids: z
          .string()
          .optional()
          .describe('Comma-separated project UUIDs (default: ≤3 sampled)'),
        allowedEmailDomains: z.string().optional().describe('Comma-separated domains → string[]'),
      },
    },
    ({ projectUuids, allowedEmailDomains }) =>
      userMessages(
        `Inspect scheduled deliveries without creating, editing, executing, enabling, disabling, or deleting schedules.

${ORGANIZATION_AUDIT_HARD_BANS}

Projects: ${projectUuids ?? '(sample ≤3)'}.
Allowed email domains: ${allowedEmailDomains ?? '(none)'}.

Use lightdash_list_project_schedulers (destinations redacted by default) and lightdash_get_scheduler when needed.
Report enabled and disabled schedules. External destinations (if revealed) are review signals, not automatic violations.`,
        'deliveries',
      ),
  );

  server.registerPrompt(
    'investigate_audit_finding',
    {
      title: 'Investigate audit finding',
      description: 'Validate or refute one previously reported finding with minimum extra metadata',
      argsSchema: {
        findingSummary: z.string().describe('The finding claim to investigate'),
        projectUuid: z
          .string()
          .optional()
          .describe('Project UUID when the finding is project-scoped'),
      },
    },
    ({ findingSummary, projectUuid }) =>
      userMessages(
        `Investigate this organization-audit finding with minimum additional metadata:

${findingSummary}

Project context: ${projectUuid ?? '(org-level or unspecified — ask only if needed)'}.

${ORGANIZATION_AUDIT_HARD_BANS}

Use only primitive list/get tools under core budgets. Report supporting evidence, contradictory evidence, remaining uncertainty, and whether severity/confidence changed. Prefer targeted get_* / single-project lists over org-wide crawls.`,
      ),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
