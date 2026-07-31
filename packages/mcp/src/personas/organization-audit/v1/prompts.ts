/**
 * MCP prompts for organization-audit workflows.
 */

/* eslint-disable @typescript-eslint/no-deprecated -- matches semantic-layer prompt registration pattern */
import { z } from 'zod';

import {
  getPlaybookMarkdown,
  ORGANIZATION_AUDIT_HARD_BANS,
  ORGANIZATION_AUDIT_PLAYBOOK_MIME,
  ORGANIZATION_AUDIT_PLAYBOOK_URI,
} from './resources/playbook.js';

import type { McpServer } from '@modelcontextprotocol/server';

function playbookEmbeddedResource() {
  return {
    type: 'resource' as const,
    resource: {
      uri: ORGANIZATION_AUDIT_PLAYBOOK_URI,
      mimeType: ORGANIZATION_AUDIT_PLAYBOOK_MIME,
      text: getPlaybookMarkdown(),
    },
  };
}

function userMessages(text: string) {
  return {
    messages: [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
      {
        role: 'user' as const,
        content: playbookEmbeddedResource(),
      },
    ],
  };
}

export function registerOrganizationAuditPrompts(server: McpServer): void {
  server.registerPrompt(
    'audit_organization',
    {
      title: 'Audit organization',
      description: 'Evidence-backed read-only organization audit',
      argsSchema: {
        projectUuids: z.string().optional().describe('Comma-separated project UUIDs'),
        allowedEmailDomains: z
          .string()
          .optional()
          .describe('Comma-separated allowed email domains'),
      },
    },
    ({ projectUuids, allowedEmailDomains }) =>
      userMessages(`Perform an evidence-backed, read-only audit of the current Lightdash organization.

${ORGANIZATION_AUDIT_HARD_BANS}

Scope:
- Use only the organization and projects visible to the authenticated caller.
- Respect any project pin (X-Lightdash-Project).
- Optional project filter: ${projectUuids ?? '(all accessible non-preview projects up to limits)'}.
- Allowed email domains for delivery review: ${allowedEmailDomains ?? '(none — treat unknown domains carefully)'}.

Procedure:
1. Resolve organization identity via lightdash_get_org_profile.
2. Prefer lightdash_audit_org_summary for a bounded full pass, or sequence focused audit tools.
3. Distinguish facts, inferred risks, policy assumptions, inaccessible areas, and truncation.
4. Cite every finding with lightdash_* tool names and resource UUIDs.
5. Do not claim formal compliance certification.`),
  );

  server.registerPrompt(
    'review_access_governance',
    {
      title: 'Review access governance',
      description: 'Build an effective-access model and identity findings',
      argsSchema: {},
    },
    () =>
      userMessages(`Review Lightdash identity and access governance.

${ORGANIZATION_AUDIT_HARD_BANS}

Use lightdash_resolve_effective_access and lightdash_audit_identity_access.
Do not treat lightdash_list_project_direct_access as complete effective access.
State assumptions and coverage gaps.`),
  );

  server.registerPrompt(
    'review_content_governance',
    {
      title: 'Review content governance',
      description: 'Inventory content health and ownership risks',
      argsSchema: {},
    },
    () =>
      userMessages(`Inventory charts, dashboards, and spaces; evaluate validation, ownership, and usage.

${ORGANIZATION_AUDIT_HARD_BANS}

Use lightdash_list_content, lightdash_list_validation_results, lightdash_get_project_user_activity, and lightdash_audit_content_health.
Do not recommend deletion solely because content is unused.`),
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
      userMessages(`Inspect scheduled deliveries without creating, editing, executing, enabling, disabling, or deleting schedules.

${ORGANIZATION_AUDIT_HARD_BANS}

Allowed email domains: ${allowedEmailDomains ?? '(none provided)'}.
Use lightdash_list_project_schedulers and lightdash_audit_scheduled_deliveries.
Redact destinations by default. External destinations are review signals, not automatic violations.`),
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
      userMessages(`Investigate this organization-audit finding with minimum additional metadata:

${findingSummary}

${ORGANIZATION_AUDIT_HARD_BANS}

Report supporting evidence, contradictory evidence, remaining uncertainty, and whether severity/confidence changed.`),
  );
}

/* eslint-enable @typescript-eslint/no-deprecated */
