/**
 * Effective-access composition golden tests.
 */

import { describe, expect, it } from 'vitest';

import { buildSpaceAccessRows, composeEffectiveAccessRecords } from './access.js';

describe('buildSpaceAccessRows', () => {
  const space = {
    uuid: 's1',
    name: 'Sales',
    access: [
      {
        userUuid: 'u-direct',
        role: 'editor',
        hasDirectAccess: true,
      },
      {
        userUuid: 'u-inherited',
        role: 'viewer',
        hasDirectAccess: false,
        inheritedFrom: 'parent_space',
        inheritedRole: 'viewer',
      },
    ],
    groupsAccess: [{ groupUuid: 'g1', spaceRole: 'viewer' }],
  };

  it('includes inherited users and provenance when includeInherited is true', () => {
    const rows = buildSpaceAccessRows([space], true);
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.principalUuid === 'u-inherited')).toMatchObject({
      inheritedFrom: 'parent_space',
      inheritedRole: 'viewer',
      hasDirectAccess: false,
    });
  });

  it('excludes inherited-only users when includeInherited is false', () => {
    const rows = buildSpaceAccessRows([space], false);
    expect(rows.map((r) => r.principalUuid).sort()).toEqual(['g1', 'u-direct']);
    expect(rows.find((r) => r.principalUuid === 'u-direct')?.inheritedFrom).toBeUndefined();
  });
});

describe('composeEffectiveAccessRecords', () => {
  it('keeps org-wide and weaker project paths without inventing precedence', () => {
    const records = composeEffectiveAccessRecords({
      orgAssignments: [{ assigneeType: 'user', assigneeId: 'u1', roleName: 'admin' }],
      projectAssignments: [{ assigneeType: 'user', assigneeId: 'u1', roleName: 'viewer' }],
      directAccess: [],
      spaceAccess: [],
      projectUuid: 'p1',
    });
    const project = records.find((r) => r.resourceType === 'project' && r.principalUuid === 'u1');
    const org = records.find((r) => r.resourceType === 'organization' && r.principalUuid === 'u1');
    expect(org?.accessPaths).toHaveLength(1);
    expect(project?.accessPaths.some((p) => p.source === 'project_direct')).toBe(true);
    expect(project?.complete).toBe(false);
  });

  it('records group-derived project access', () => {
    const records = composeEffectiveAccessRecords({
      orgAssignments: [],
      projectAssignments: [{ assigneeType: 'group', assigneeId: 'g1', roleName: 'editor' }],
      directAccess: [],
      spaceAccess: [],
      projectUuid: 'p1',
    });
    expect(records[0]?.accessPaths[0]?.source).toBe('project_group');
  });

  it('marks inherited space access', () => {
    const records = composeEffectiveAccessRecords({
      orgAssignments: [],
      projectAssignments: [],
      directAccess: [],
      spaceAccess: [
        {
          spaceUuid: 's1',
          principalType: 'user',
          principalUuid: 'u1',
          role: 'viewer',
          inheritedFrom: 'parent_space',
          hasDirectAccess: false,
        },
      ],
      projectUuid: 'p1',
    });
    expect(records[0]?.accessPaths[0]?.source).toBe('space_inherited');
  });
});
