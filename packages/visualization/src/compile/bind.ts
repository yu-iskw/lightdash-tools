import { VisualizationError } from '../errors';

import type {
  VisualizationColumn,
  VisualizationDataset,
  VisualizationDataType,
} from '../data/dataset';
import type { FieldRole, FieldRoleMap } from '../spec/types';

export type RoleTypeRequirement = VisualizationDataType[];

export type TemplateRoleRequirements = Partial<
  Record<FieldRole, { required: boolean; dataTypes: RoleTypeRequirement }>
>;

function assertCompatibleType(
  role: FieldRole,
  fieldId: string,
  column: VisualizationColumn,
  dataTypes: RoleTypeRequirement,
): void {
  if (
    dataTypes.length === 0 ||
    dataTypes.includes(column.dataType) ||
    column.dataType === 'unknown'
  ) {
    return;
  }
  throw new VisualizationError(
    'INCOMPATIBLE_FIELD_TYPE',
    `Field "${fieldId}" for role "${role}" has type "${column.dataType}", expected one of: ${dataTypes.join(', ')}`,
    { role, fieldId, dataType: column.dataType, expected: dataTypes },
  );
}

function requireColumn(
  columnById: Map<string, VisualizationColumn>,
  role: FieldRole,
  fieldId: string,
): VisualizationColumn {
  const column = columnById.get(fieldId);
  if (!column) {
    throw new VisualizationError('UNKNOWN_FIELD', `Unknown field "${fieldId}" for role "${role}"`, {
      role,
      fieldId,
    });
  }
  return column;
}

export function requireBoundRole(bound: FieldRoleMap, role: FieldRole): string {
  const fieldId = bound[role];
  if (!fieldId) {
    throw new VisualizationError('MISSING_REQUIRED_ROLE', `Template requires role "${role}"`, {
      role,
    });
  }
  return fieldId;
}

export function bindRoles(
  roles: FieldRoleMap,
  dataset: VisualizationDataset,
  requirements: TemplateRoleRequirements,
): FieldRoleMap {
  const columnById = new Map(dataset.columns.map((c) => [c.fieldId, c]));
  const bound: FieldRoleMap = {};

  for (const [role, req] of Object.entries(requirements) as Array<
    [FieldRole, { required: boolean; dataTypes: RoleTypeRequirement }]
  >) {
    const fieldId = roles[role];
    if (!fieldId) {
      if (req.required) {
        throw new VisualizationError('MISSING_REQUIRED_ROLE', `Template requires role "${role}"`, {
          role,
        });
      }
      continue;
    }
    const column = requireColumn(columnById, role, fieldId);
    assertCompatibleType(role, fieldId, column, req.dataTypes);
    bound[role] = fieldId;
  }

  for (const [role, fieldId] of Object.entries(roles) as Array<[FieldRole, string | undefined]>) {
    if (!fieldId || bound[role]) continue;
    requireColumn(columnById, role, fieldId);
    bound[role] = fieldId;
  }

  return bound;
}
