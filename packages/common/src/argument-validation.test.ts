import { describe, it, expect } from 'vitest';

import {
  RESOURCE_ID_KEYS,
  validateArguments,
  validateResourceIdsInObject,
} from './argument-validation';

import type { ArgumentDescriptor } from './argument-validation';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('argument-validation', () => {
  describe('RESOURCE_ID_KEYS', () => {
    it('contains all RFC Phase 0 identifier keys', () => {
      expect([...RESOURCE_ID_KEYS].sort()).toEqual(
        [
          'agentUuid',
          'artifactUuid',
          'chartUuid',
          'chartUuidOrSlug',
          'contentUuidOrSlug',
          'dashboardUuid',
          'dashboardUuidOrSlug',
          'evalUuid',
          'fingerprint',
          'groupUuid',
          'itemUuids',
          'mcpServerUuid',
          'messageUuid',
          'newSlug',
          'organizationUuid',
          'parentSpaceUuid',
          'project',
          'projectUuid',
          'projectUuids',
          'projects',
          'promptUuid',
          'roleUuid',
          'runUuid',
          'savedQueryUuid',
          'schedulerUuid',
          'slug',
          'sourceChartUuidOrSlug',
          'sourceDashboardUuid',
          'spaceUuid',
          'spaceUuids',
          'targetSpaceUuid',
          'threadUuid',
          'tileUuid',
          'toolCallId',
          'userUuid',
          'versionUuid',
          'versionUuidA',
          'versionUuidB',
        ].sort(),
      );
    });
  });

  describe('validateArguments', () => {
    it('validates uuid arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'projectUuid', source: 'option', semanticType: 'uuid', required: true },
      ];
      expect(() => validateArguments({ projectUuid: VALID_UUID }, descriptors)).not.toThrow();
      expect(() => validateArguments({ projectUuid: 'bad-uuid' }, descriptors)).toThrow(
        'Invalid UUID format',
      );
    });

    it('validates slug arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'slug', source: 'option', semanticType: 'slug' },
      ];
      expect(() => validateArguments({ slug: 'my-chart' }, descriptors)).not.toThrow();
      expect(() => validateArguments({ slug: 'bad slug' }, descriptors)).toThrow(
        'Slug must contain only alphanumeric characters',
      );
    });

    it('validates fingerprint arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'fingerprint', source: 'body', semanticType: 'fingerprint' },
      ];
      expect(() => validateArguments({ fingerprint: 'abc123' }, descriptors)).not.toThrow();
      expect(() => validateArguments({ fingerprint: '' }, descriptors)).toThrow(
        'Fingerprint must be between 1 and 512 characters',
      );
    });

    it('throws when required argument is missing', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'projectUuid', source: 'option', semanticType: 'uuid', required: true },
      ];
      expect(() => validateArguments({}, descriptors)).toThrow(
        "Required argument 'projectUuid' is missing",
      );
    });

    it('skips optional missing arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'slug', source: 'option', semanticType: 'slug' },
      ];
      expect(() => validateArguments({}, descriptors)).not.toThrow();
    });

    it('validates uuid arrays', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'projectUuid', source: 'body', semanticType: 'uuid' },
      ];
      expect(() =>
        validateArguments({ projectUuid: [VALID_UUID, VALID_UUID] }, descriptors),
      ).not.toThrow();
      expect(() =>
        validateArguments({ projectUuid: [VALID_UUID, 'not-uuid'] }, descriptors),
      ).toThrow('Invalid UUID format');
    });

    it('validates free-text with control char rejection only', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'query', source: 'positional', semanticType: 'free-text' },
      ];
      expect(() => validateArguments({ query: 'what? growth%' }, descriptors)).not.toThrow();
      expect(() => validateArguments({ query: 'bad\u0000' }, descriptors)).toThrow(
        'Input contains invalid control characters',
      );
    });

    it('validates json string arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'payload', source: 'body', semanticType: 'json' },
      ];
      expect(() => validateArguments({ payload: '{"a":1}' }, descriptors)).not.toThrow();
      expect(() => validateArguments({ payload: 'not-json' }, descriptors)).toThrow(
        "Argument 'payload' must be valid JSON",
      );
    });

    it('validates boolean arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'enabled', source: 'option', semanticType: 'boolean' },
      ];
      expect(() => validateArguments({ enabled: true }, descriptors)).not.toThrow();
      expect(() => validateArguments({ enabled: 'true' }, descriptors)).toThrow(
        "Argument 'enabled' must be a boolean",
      );
    });

    it('validates number arguments', () => {
      const descriptors: ArgumentDescriptor[] = [
        { name: 'limit', source: 'option', semanticType: 'number' },
      ];
      expect(() => validateArguments({ limit: 10 }, descriptors)).not.toThrow();
      expect(() => validateArguments({ limit: Number.NaN }, descriptors)).toThrow(
        "Argument 'limit' must be a number",
      );
    });
  });

  describe('validateResourceIdsInObject', () => {
    it('validates top-level resource id keys', () => {
      expect(() =>
        validateResourceIdsInObject({
          projectUuid: VALID_UUID,
          slug: 'my-chart',
        }),
      ).not.toThrow();
    });

    it('validates projectUuids / projects array entries as UUIDs', () => {
      expect(() => validateResourceIdsInObject({ projectUuids: [VALID_UUID] })).not.toThrow();
      expect(() => validateResourceIdsInObject({ projectUuids: [VALID_UUID, 'bad-uuid'] })).toThrow(
        'Invalid UUID format',
      );
      expect(() => validateResourceIdsInObject({ projects: ['bad-uuid'] })).toThrow(
        'Invalid UUID format',
      );
    });

    it('validates nested resource id keys', () => {
      expect(() =>
        validateResourceIdsInObject({
          filter: {
            agentUuid: VALID_UUID,
            nested: {
              threadUuid: VALID_UUID,
            },
          },
        }),
      ).not.toThrow();
    });

    it('validates resource id keys inside arrays', () => {
      expect(() =>
        validateResourceIdsInObject([{ projectUuid: VALID_UUID }, { projectUuid: 'bad-uuid' }]),
      ).toThrow('Invalid UUID format');
    });

    it('validates uuid keys with uuid rules', () => {
      expect(() => validateResourceIdsInObject({ runUuid: 'not-a-uuid' })).toThrow(
        'Invalid UUID format',
      );
    });

    it('validates slug key with slug rules', () => {
      expect(() => validateResourceIdsInObject({ slug: 'bad slug' })).toThrow(
        'Slug must contain only alphanumeric characters',
      );
    });

    it('accepts UUID or slug for dashboardUuid and chartUuid', () => {
      expect(() => validateResourceIdsInObject({ dashboardUuid: 'sales-overview' })).not.toThrow();
      expect(() => validateResourceIdsInObject({ dashboardUuid: VALID_UUID })).not.toThrow();
      expect(() => validateResourceIdsInObject({ chartUuid: 'my-chart' })).not.toThrow();
      expect(() => validateResourceIdsInObject({ dashboardUuid: 'bad?' })).toThrow(
        'Slug must contain only alphanumeric characters',
      );
      expect(() => validateResourceIdsInObject({ dashboardUuid: '..' })).toThrow(
        'Slug must not contain path traversal segments',
      );
    });

    it('validates chartUuidOrSlug/dashboardUuidOrSlug and itemUuids/targetSpaceUuid', () => {
      expect(() =>
        validateResourceIdsInObject({
          chartUuidOrSlug: 'my-chart',
          dashboardUuidOrSlug: VALID_UUID,
          itemUuids: [VALID_UUID],
          targetSpaceUuid: VALID_UUID,
        }),
      ).not.toThrow();
      expect(() => validateResourceIdsInObject({ itemUuids: [VALID_UUID, 'bad-uuid'] })).toThrow(
        'Invalid UUID format',
      );
      expect(() => validateResourceIdsInObject({ targetSpaceUuid: 'bad?' })).toThrow(
        'Invalid UUID format',
      );
      expect(() => validateResourceIdsInObject({ chartUuidOrSlug: 'bad?' })).toThrow(
        'Slug must contain only alphanumeric characters',
      );
    });

    it('validates spaceUuids and parentSpaceUuid as UUIDs', () => {
      expect(() =>
        validateResourceIdsInObject({
          spaceUuids: [VALID_UUID],
          parentSpaceUuid: VALID_UUID,
        }),
      ).not.toThrow();
      expect(() => validateResourceIdsInObject({ spaceUuids: ['bad?'] })).toThrow(
        'Invalid UUID format',
      );
      expect(() => validateResourceIdsInObject({ parentSpaceUuid: '..' })).toThrow(
        'Invalid UUID format',
      );
    });

    it('validates fingerprint and toolCallId with fingerprint rules', () => {
      expect(() =>
        validateResourceIdsInObject({
          fingerprint: 'fp-123',
          toolCallId: 'call-abc',
        }),
      ).not.toThrow();
      expect(() => validateResourceIdsInObject({ fingerprint: '' })).toThrow(
        'Fingerprint must be between 1 and 512 characters',
      );
      expect(() => validateResourceIdsInObject({ toolCallId: '' })).toThrow(
        'Fingerprint must be between 1 and 512 characters',
      );
    });

    it('validates string arrays under resource id keys', () => {
      expect(() =>
        validateResourceIdsInObject({
          projectUuid: [VALID_UUID, VALID_UUID],
        }),
      ).not.toThrow();
      expect(() =>
        validateResourceIdsInObject({
          projectUuid: [VALID_UUID, 'invalid'],
        }),
      ).toThrow('Invalid UUID format');
    });

    it('ignores non-resource keys', () => {
      expect(() =>
        validateResourceIdsInObject({
          query: 'what? growth%',
          name: '../etc/passwd',
        }),
      ).not.toThrow();
    });

    it('handles null and undefined', () => {
      expect(() => validateResourceIdsInObject(null)).not.toThrow();
      expect(() => validateResourceIdsInObject(undefined)).not.toThrow();
    });
  });
});
