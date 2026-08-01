/**
 * Flat form schema and message builders for soft-delete confirmation (ADR-0015).
 */

import type { ConfirmationTarget } from './types.js';

export type DeleteConfirmFormContent = {
  decision: 'confirm_delete' | 'do_not_delete';
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

export function normalizeResourceName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function buildDeleteConfirmationMessage(target: ConfirmationTarget): string {
  const lines = [
    `Confirm soft-deletion of this Lightdash ${target.resourceType}.`,
    `Name: ${target.resourceName}`,
    `${target.resourceType === 'chart' ? 'Chart' : 'Dashboard'} UUID/slug: ${target.resourceId}`,
    `Project UUID: ${target.projectUuid}`,
  ];
  if (target.location) {
    lines.push(`Space: ${target.location}`);
  }
  if (target.updatedAt) {
    lines.push(`Updated at: ${target.updatedAt}`);
  }
  for (const consequence of target.consequences) {
    lines.push(consequence);
  }
  lines.push(
    'Type the exact resource name to confirm. Soft-deleted items can be restored from trash.',
  );
  return lines.join('\n');
}

export function isAcceptedDeleteForm(
  content: DeleteConfirmFormContent | undefined,
  expectedName: string,
): content is DeleteConfirmFormContent {
  if (!content) {
    return false;
  }
  if (content.decision !== 'confirm_delete') {
    return false;
  }
  return normalizeResourceName(content.confirmationText) === normalizeResourceName(expectedName);
}
