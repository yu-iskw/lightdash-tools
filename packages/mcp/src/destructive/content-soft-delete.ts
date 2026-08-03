/**
 * Shared soft-delete operation specs for charts and dashboards (ADR-0015).
 */

import { WRITE_DESTRUCTIVE } from '@lightdash-tools/common';

import { isNotFoundError } from '../tools/lib/api-errors.js';
import { uuidOrSlugField } from '../tools/lib/schema-fields.js';

import { buildContentPrecondition } from './precondition.js';
import { registerDestructiveDeleteTool } from './register-destructive-tool.js';

import type { ScopedDestructiveArgs } from './register-destructive-tool.js';
import type { DestructiveOperationSpec, DestructiveResourceType } from './types.js';
import type { McpContextProvider } from '../server/request-context.js';
import type { Dashboard, LightdashClient, SavedChart } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/server';

type SoftDeleteSnapshot = {
  uuid?: string;
  slug: string;
  name: string;
  projectUuid: string;
  spaceName: string;
  spaceUuid: string;
  updatedAt: string;
};

type SoftDeleteResourceConfig = {
  shortName: 'delete_chart' | 'delete_dashboard';
  title: string;
  description: string;
  operationId: string;
  resourceType: DestructiveResourceType;
  resourceIdArgName: 'chartUuidOrSlug' | 'dashboardUuidOrSlug';
  resourceIdLabel: string;
  get: (client: LightdashClient, projectUuid: string, id: string) => Promise<SoftDeleteSnapshot>;
  del: (client: LightdashClient, projectUuid: string, id: string) => Promise<void>;
};

function toSoftDeleteSnapshot(resource: Dashboard | SavedChart): SoftDeleteSnapshot {
  return {
    uuid: resource.uuid,
    slug: resource.slug,
    name: resource.name,
    projectUuid: resource.projectUuid,
    spaceName: resource.spaceName,
    spaceUuid: resource.spaceUuid,
    updatedAt: resource.updatedAt,
  };
}

function buildSoftDeleteSpec(
  config: SoftDeleteResourceConfig,
): DestructiveOperationSpec<ScopedDestructiveArgs, SoftDeleteSnapshot> {
  const noun = config.resourceType;
  return {
    operationId: config.operationId,
    resourceType: config.resourceType,
    async resolveTarget(args, ctx) {
      return config.get(ctx.lightdashClient, args.projectUuid, args.resourceId);
    },
    summarizeTarget(snapshot) {
      return {
        operation: 'delete',
        resourceType: config.resourceType,
        resourceId: snapshot.uuid ?? snapshot.slug,
        resourceName: snapshot.name,
        projectUuid: snapshot.projectUuid,
        location: snapshot.spaceName,
        updatedAt: snapshot.updatedAt,
        consequences: [
          `The ${noun} will be soft-deleted and hidden from normal lists.`,
          'It can be restored from deleted content until permanently purged.',
        ],
      };
    },
    getPrecondition(snapshot) {
      return buildContentPrecondition({
        resourceType: config.resourceType,
        resourceId: snapshot.uuid ?? snapshot.slug,
        projectUuid: snapshot.projectUuid,
        name: snapshot.name,
        updatedAt: snapshot.updatedAt,
        spaceUuid: snapshot.spaceUuid,
      });
    },
    async execute(args, _snapshot, ctx) {
      try {
        await config.del(ctx.lightdashClient, args.projectUuid, args.resourceId);
      } catch (err) {
        if (isNotFoundError(err)) {
          return;
        }
        throw err;
      }
    },
  };
}

function registerContentSoftDeleteTool(
  server: McpServer,
  contextProvider: McpContextProvider,
  config: SoftDeleteResourceConfig,
): void {
  registerDestructiveDeleteTool(
    server,
    config.shortName,
    {
      title: config.title,
      description: config.description,
      annotations: WRITE_DESTRUCTIVE,
      resourceIdField: uuidOrSlugField(config.resourceIdLabel),
      resourceIdArgName: config.resourceIdArgName,
    },
    contextProvider,
    buildSoftDeleteSpec(config),
  );
}

export function registerDeleteChart(server: McpServer, contextProvider: McpContextProvider): void {
  registerContentSoftDeleteTool(server, contextProvider, {
    shortName: 'delete_chart',
    title: 'Soft-delete Lightdash chart',
    description:
      'Soft-delete a saved chart after form elicitation confirmation (restorable from trash). Requires a client that supports form elicitation.',
    operationId: 'content-governance.charts.delete',
    resourceType: 'chart',
    resourceIdArgName: 'chartUuidOrSlug',
    resourceIdLabel: 'Chart UUID or slug',
    get: async (client, projectUuid, id) =>
      toSoftDeleteSnapshot(await client.v2.charts.getSavedChart(projectUuid, id)),
    del: (client, projectUuid, id) => client.v2.charts.deleteSavedChart(projectUuid, id),
  });
}

export function registerDeleteDashboard(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerContentSoftDeleteTool(server, contextProvider, {
    shortName: 'delete_dashboard',
    title: 'Soft-delete Lightdash dashboard',
    description:
      'Soft-delete a dashboard after form elicitation confirmation (restorable from trash). Requires a client that supports form elicitation.',
    operationId: 'content-governance.dashboards.delete',
    resourceType: 'dashboard',
    resourceIdArgName: 'dashboardUuidOrSlug',
    resourceIdLabel: 'Dashboard UUID or slug',
    get: async (client, projectUuid, id) =>
      toSoftDeleteSnapshot(await client.v2.dashboards.getDashboard(projectUuid, id)),
    del: (client, projectUuid, id) => client.v2.dashboards.deleteDashboard(projectUuid, id),
  });
}
