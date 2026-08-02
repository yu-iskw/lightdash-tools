import { describe, expect, it } from 'vitest';

import {
  buildDeleteConfirmationMessage,
  buildPromoteConfirmationMessage,
  isAcceptedDeleteForm,
  isAcceptedPromoteForm,
  normalizeResourceName,
} from './confirmation.js';

import type { ConfirmationTarget } from './types.js';

const target: ConfirmationTarget = {
  operation: 'delete',
  resourceType: 'chart',
  resourceId: 'chart-1',
  resourceName: 'Revenue KPI',
  projectUuid: '11111111-1111-1111-1111-111111111111',
  location: 'Finance',
  updatedAt: '2026-08-01T00:00:00.000Z',
  consequences: ['Hidden from normal lists.', 'Restorable from trash.'],
};

const promoteTarget: ConfirmationTarget = {
  operation: 'promote',
  resourceType: 'dashboard',
  resourceId: 'dash-1',
  resourceName: 'Exec Overview',
  projectUuid: '11111111-1111-1111-1111-111111111111',
  location: 'Executive',
  updatedAt: '2026-08-01T00:00:00.000Z',
  details: ['Charts: 2 create, 1 update'],
  consequences: ['Nested charts may be overwritten upstream.'],
};

describe('normalizeResourceName', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeResourceName('  Revenue   KPI  ')).toBe('Revenue KPI');
  });
});

describe('buildDeleteConfirmationMessage', () => {
  it('includes identity fields and consequences', () => {
    const message = buildDeleteConfirmationMessage(target);
    expect(message).toContain('Confirm soft-deletion of this Lightdash chart.');
    expect(message).toContain('Name: Revenue KPI');
    expect(message).toContain('Chart UUID/slug: chart-1');
    expect(message).toContain('Project UUID: 11111111-1111-1111-1111-111111111111');
    expect(message).toContain('Space: Finance');
    expect(message).toContain('Updated at: 2026-08-01T00:00:00.000Z');
    expect(message).toContain('Hidden from normal lists.');
    expect(message).toContain('Type the exact resource name to confirm');
  });
});

describe('isAcceptedDeleteForm', () => {
  it('rejects missing content', () => {
    expect(isAcceptedDeleteForm(undefined, 'Revenue KPI')).toBe(false);
  });

  it('rejects decline decisions', () => {
    expect(
      isAcceptedDeleteForm(
        { decision: 'do_not_delete', confirmationText: 'Revenue KPI' },
        'Revenue KPI',
      ),
    ).toBe(false);
  });

  it('rejects mismatched confirmation text', () => {
    expect(
      isAcceptedDeleteForm(
        { decision: 'confirm_delete', confirmationText: 'Wrong Name' },
        'Revenue KPI',
      ),
    ).toBe(false);
  });

  it('accepts confirm_delete with normalized matching name', () => {
    expect(
      isAcceptedDeleteForm(
        { decision: 'confirm_delete', confirmationText: '  Revenue   KPI ' },
        'Revenue KPI',
      ),
    ).toBe(true);
  });
});

describe('buildPromoteConfirmationMessage', () => {
  it('includes promoteDiff details and upstream consequences', () => {
    const message = buildPromoteConfirmationMessage(promoteTarget);
    expect(message).toContain('Confirm promotion of this Lightdash dashboard');
    expect(message).toContain('Name: Exec Overview');
    expect(message).toContain('Charts: 2 create, 1 update');
    expect(message).toContain('Nested charts may be overwritten upstream.');
    expect(message).toContain('Type the exact dashboard name to confirm');
  });
});

describe('isAcceptedPromoteForm', () => {
  it('rejects decline decisions', () => {
    expect(
      isAcceptedPromoteForm(
        { decision: 'do_not_promote', confirmationText: 'Exec Overview' },
        'Exec Overview',
      ),
    ).toBe(false);
  });

  it('accepts confirm_promote with matching name', () => {
    expect(
      isAcceptedPromoteForm(
        { decision: 'confirm_promote', confirmationText: 'Exec Overview' },
        'Exec Overview',
      ),
    ).toBe(true);
  });
});
