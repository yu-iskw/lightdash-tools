/**
 * Flat form schemas and message builders for elicitation-gated mutations
 * (ADR-0015 soft-delete, ADR-0017 dashboard promote).
 */

import type { ConfirmationTarget } from './types.js';

export type DeleteConfirmFormContent = {
  decision: 'confirm_delete' | 'do_not_delete';
  confirmationText: string;
};

export type PromoteConfirmFormContent = {
  decision: 'confirm_promote' | 'do_not_promote';
  confirmationText: string;
};

/** Flat JSON Schema for form-mode elicitation (primitives only). */
export const DELETE_CONFIRM_FORM_SCHEMA = {
  type: 'object' as const,
  properties: {
    decision: {
      type: 'string' as const,
      title: 'Delete resource?',
      description: 'This soft-deletes the specified Lightdash resource (restorable from trash).',
      enum: ['confirm_delete', 'do_not_delete'],
      enumNames: ['Delete (soft-delete)', 'Keep resource'],
      default: 'do_not_delete',
    },
    confirmationText: {
      type: 'string' as const,
      title: 'Type the resource name',
      description: 'Enter the exact resource name shown in the message.',
    },
  },
  // Mutable `string[]` required by MCP form elicitation schema typing.
  required: ['decision', 'confirmationText'],
};

export const PROMOTE_CONFIRM_FORM_SCHEMA = {
  type: 'object' as const,
  properties: {
    decision: {
      type: 'string' as const,
      title: 'Promote dashboard?',
      description:
        'This promotes the dashboard (and nested charts/spaces/data apps) to the configured upstream project.',
      enum: ['confirm_promote', 'do_not_promote'],
      enumNames: ['Promote to upstream', 'Do not promote'],
      default: 'do_not_promote',
    },
    confirmationText: {
      type: 'string' as const,
      title: 'Type the dashboard name',
      description: 'Enter the exact dashboard name shown in the message.',
    },
  },
  required: ['decision', 'confirmationText'],
};

export type ConfirmFormSchema =
  typeof DELETE_CONFIRM_FORM_SCHEMA | typeof PROMOTE_CONFIRM_FORM_SCHEMA;

export function normalizeResourceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

function appendTargetLines(lines: string[], target: ConfirmationTarget): void {
  lines.push(`Name: ${target.resourceName}`);
  lines.push(
    `${target.resourceType === 'chart' ? 'Chart' : 'Dashboard'} UUID/slug: ${target.resourceId}`,
  );
  lines.push(`Project UUID: ${target.projectUuid}`);
  if (target.location) {
    lines.push(`Space: ${target.location}`);
  }
  if (target.updatedAt) {
    lines.push(`Updated at: ${target.updatedAt}`);
  }
  for (const detail of target.details ?? []) {
    lines.push(detail);
  }
  for (const consequence of target.consequences) {
    lines.push(consequence);
  }
}

export function buildDeleteConfirmationMessage(target: ConfirmationTarget): string {
  const lines = [`Confirm soft-deletion of this Lightdash ${target.resourceType}.`];
  appendTargetLines(lines, target);
  lines.push(
    'Type the exact resource name to confirm. Soft-deleted items can be restored from trash.',
  );
  return lines.join('\n');
}

export function buildPromoteConfirmationMessage(target: ConfirmationTarget): string {
  const lines = [
    'Confirm promotion of this Lightdash dashboard to its configured upstream project.',
  ];
  appendTargetLines(lines, target);
  lines.push(
    'Type the exact dashboard name to confirm. Nested charts, spaces, and data apps may be created or overwritten upstream.',
  );
  return lines.join('\n');
}

function isAcceptedConfirmForm<TDecision extends string>(
  content: { decision: TDecision; confirmationText: string } | undefined,
  acceptDecision: TDecision,
  expectedName: string,
): boolean {
  if (!content || content.decision !== acceptDecision) {
    return false;
  }
  return normalizeResourceName(content.confirmationText) === normalizeResourceName(expectedName);
}

export function isAcceptedDeleteForm(
  content: DeleteConfirmFormContent | undefined,
  expectedName: string,
): content is DeleteConfirmFormContent {
  return isAcceptedConfirmForm(content, 'confirm_delete', expectedName);
}

export function isAcceptedPromoteForm(
  content: PromoteConfirmFormContent | undefined,
  expectedName: string,
): content is PromoteConfirmFormContent {
  return isAcceptedConfirmForm(content, 'confirm_promote', expectedName);
}
