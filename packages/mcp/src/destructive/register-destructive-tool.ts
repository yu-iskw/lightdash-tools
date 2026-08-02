/**
 * Central wrapper for elicitation-gated destructive MCP tools (ADR-0015).
 */

import { WRITE_DESTRUCTIVE } from '@lightdash-tools/common';
import { acceptedContent, inputRequired, inputResponse } from '@modelcontextprotocol/server';

import { ProjectScopeError, resolveProjectScope } from '../governance/project-scope.js';
import { isNotFoundError } from '../tools/lib/api-errors.js';
import { projectUuidField } from '../tools/lib/schema-fields.js';
import { codedErrorResult, projectScopeErrorResult } from '../tools/query/reader-tool-helpers.js';
import {
  jsonToolResult,
  registerToolSafe,
  withAuditStatus,
  withLightdashBlockedMarker,
  wrapToolContextual,
} from '../tools/shared.js';

import { supportsFormElicitation } from './capability.js';
import {
  buildDeleteConfirmationMessage,
  DELETE_CONFIRM_FORM_SCHEMA,
  isAcceptedDeleteForm,
  type DeleteConfirmFormContent,
} from './confirmation.js';
import { mintDestructiveRequestState, verifyDestructiveRequestState } from './request-state.js';
import {
  CONFIRM_INPUT_KEY,
  type DestructiveOperationSpec,
  type DestructiveRequestState,
} from './types.js';

import type { McpContextProvider } from '../server/request-context.js';
import type { ToolExecutionContext, ToolOptions, ToolResult } from '../tools/shared.js';
import type { ToolAnnotations } from '@lightdash-tools/common';
import type { ClientCapabilities, McpServer, ServerContext } from '@modelcontextprotocol/server';
import type { z } from 'zod';

/** Args after project scope resolution (projectUuid always set). */
export type ScopedDestructiveArgs = {
  projectUuid: string;
  resourceId: string;
};

export type RegisterDestructiveDeleteOptions = {
  title: string;
  description: string;
  annotations?: ToolAnnotations;
  /** Zod field for the resource identifier (uuid or slug). */
  resourceIdField: z.ZodType<string>;
  resourceIdArgName: 'chartUuidOrSlug' | 'dashboardUuidOrSlug';
};

async function readBoundRequestState(
  serverContext: ServerContext,
): Promise<DestructiveRequestState | undefined> {
  const mcpReq = serverContext.mcpReq as {
    requestState?: string | (() => unknown);
  };
  const raw =
    typeof mcpReq.requestState === 'function' ? mcpReq.requestState() : mcpReq.requestState;
  // AEAD token (preferred): verify via codec.
  if (typeof raw === 'string') {
    return verifyDestructiveRequestState(raw, serverContext);
  }
  // 2025-era SDK legacy elicitation shim may echo the decoded payload object.
  if (raw && typeof raw === 'object' && 'preconditionDigest' in raw && 'operationId' in raw) {
    return raw as DestructiveRequestState;
  }
  return undefined;
}

function confirmationInvalidResult(message: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'CONFIRMATION_INVALID',
      message,
      deleted: false,
    }),
  );
}

function elicitationRequiredResult(message: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'ELICITATION_REQUIRED',
      message,
      deleted: false,
    }),
  );
}

function declinedOrCancelledResult<TSnapshot>(
  action: 'cancelled' | 'declined',
  auditStatus: 'confirmation_cancelled' | 'confirmation_declined',
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
): ToolResult {
  return withAuditStatus(
    jsonToolResult({
      status: action,
      deleted: false,
      operation: 'delete',
      resourceType: spec.resourceType,
      resourceId: scopedArgs.resourceId,
      projectUuid: scopedArgs.projectUuid,
    }),
    auditStatus,
  );
}

function bindingMatches<TSnapshot>(
  boundState: DestructiveRequestState,
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
  sessionId: string,
): boolean {
  return (
    boundState.operationId === spec.operationId &&
    boundState.resourceType === spec.resourceType &&
    boundState.resourceId === scopedArgs.resourceId &&
    boundState.projectUuid === scopedArgs.projectUuid &&
    boundState.sessionId === sessionId
  );
}

type ResolveOutcome<TSnapshot> =
  { ok: false; result: ToolResult } | { ok: true; snapshot: TSnapshot };

async function resolveTargetOrNotFound<TSnapshot>(
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
  ctx: ToolExecutionContext,
): Promise<ResolveOutcome<TSnapshot>> {
  try {
    return { ok: true, snapshot: await spec.resolveTarget(scopedArgs, ctx) };
  } catch (err) {
    if (err instanceof ProjectScopeError) {
      return { ok: false, result: projectScopeErrorResult(err) };
    }
    if (isNotFoundError(err)) {
      return {
        ok: false,
        result: codedErrorResult(
          'CONTENT_NOT_FOUND',
          `${spec.resourceType} '${scopedArgs.resourceId}' was not found`,
        ),
      };
    }
    throw err;
  }
}

async function applyAcceptedDelete<TSnapshot>(input: {
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>;
  scopedArgs: ScopedDestructiveArgs;
  boundState: DestructiveRequestState;
  accepted: DeleteConfirmFormContent;
  ctx: ToolExecutionContext;
}): Promise<ToolResult> {
  const { spec, scopedArgs, boundState, accepted, ctx } = input;
  if (!bindingMatches(boundState, spec, scopedArgs, ctx.sessionId)) {
    return confirmationInvalidResult('Confirmation binding does not match this delete request.');
  }

  if (!isAcceptedDeleteForm(accepted, boundState.resourceName)) {
    return confirmationInvalidResult(
      'Confirmation was not accepted, or the typed resource name did not match.',
    );
  }

  const resolved = await resolveTargetOrNotFound(spec, scopedArgs, ctx);
  if (!resolved.ok) {
    return resolved.result;
  }
  const { snapshot } = resolved;
  // Identity is already checked in bindingMatches (tool arg). Digest uses canonical
  // snapshot ids, so do not require arg slug === uuid via samePrecondition.
  const currentPre = spec.getPrecondition(snapshot);
  if (currentPre.digest !== boundState.preconditionDigest) {
    return withAuditStatus(
      withLightdashBlockedMarker(
        jsonToolResult({
          status: 'blocked',
          code: 'RESOURCE_CHANGED',
          message:
            'The resource changed after confirmation was requested. Review it and confirm again.',
          deleted: false,
        }),
      ),
      'resource_changed',
    );
  }

  try {
    await spec.execute(scopedArgs, snapshot, ctx);
  } catch (err) {
    return withAuditStatus(
      jsonToolResult({
        status: 'error',
        deleted: false,
        code: 'DELETION_FAILED',
        message: err instanceof Error ? err.message : String(err),
        operation: 'delete',
        resourceType: spec.resourceType,
        resourceId: scopedArgs.resourceId,
        projectUuid: scopedArgs.projectUuid,
      }),
      'deletion_failed',
    );
  }

  const target = spec.summarizeTarget(snapshot);
  return withAuditStatus(
    jsonToolResult({
      status: 'deleted',
      operation: 'delete',
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      resourceName: target.resourceName,
      projectUuid: target.projectUuid,
      deletedAt: new Date().toISOString(),
      confirmation: { mode: 'form', action: 'accept' },
    }),
    'deletion_succeeded',
  );
}

function requireFormElicitation(
  server: McpServer,
  serverContext: ServerContext | undefined,
): ToolResult | undefined {
  // 2026: per-request envelope; 2025: initialize-declared caps via Server.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- 2025-era fallback; envelope preferred in capability.ts
  const initializeCaps = server.server.getClientCapabilities() as ClientCapabilities | undefined;
  if (!supportsFormElicitation(serverContext, initializeCaps)) {
    return elicitationRequiredResult(
      'This destructive operation requires an MCP client that supports form elicitation.',
    );
  }
  if (!serverContext) {
    return elicitationRequiredResult('Missing MCP ServerContext required for elicitation.');
  }
  return undefined;
}

function declineOrCancelIfPresent<TSnapshot>(
  serverContext: ServerContext,
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
): ToolResult | undefined {
  const responseView = inputResponse(serverContext.mcpReq.inputResponses, CONFIRM_INPUT_KEY);
  if (responseView.kind === 'elicit' && responseView.action === 'decline') {
    return declinedOrCancelledResult('declined', 'confirmation_declined', spec, scopedArgs);
  }
  if (responseView.kind === 'elicit' && responseView.action === 'cancel') {
    return declinedOrCancelledResult('cancelled', 'confirmation_cancelled', spec, scopedArgs);
  }
  return undefined;
}

async function requestDeleteConfirmation<TSnapshot>(
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
  ctx: ToolExecutionContext,
  serverContext: ServerContext,
): Promise<ToolResult> {
  const resolved = await resolveTargetOrNotFound(spec, scopedArgs, ctx);
  if (!resolved.ok) {
    return resolved.result;
  }
  const { snapshot } = resolved;
  const target = spec.summarizeTarget(snapshot);
  const precondition = spec.getPrecondition(snapshot);
  const stateToken = await mintDestructiveRequestState(
    {
      operationId: spec.operationId,
      resourceType: spec.resourceType,
      resourceId: scopedArgs.resourceId,
      projectUuid: scopedArgs.projectUuid,
      preconditionDigest: precondition.digest,
      sessionId: ctx.sessionId,
      resourceName: target.resourceName,
    },
    serverContext,
  );

  return inputRequired({
    requestState: stateToken,
    inputRequests: {
      [CONFIRM_INPUT_KEY]: inputRequired.elicit({
        mode: 'form',
        message: buildDeleteConfirmationMessage(target),
        requestedSchema: DELETE_CONFIRM_FORM_SCHEMA,
      }),
    },
  });
}

async function handleDestructiveDelete<TSnapshot>(
  server: McpServer,
  options: RegisterDestructiveDeleteOptions,
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  ctx: ToolExecutionContext,
  rawArgs: unknown,
): Promise<ToolResult> {
  const argsRecord = rawArgs as Record<string, unknown>;
  const resourceId = argsRecord[options.resourceIdArgName];
  if (typeof resourceId !== 'string' || resourceId.length === 0) {
    return codedErrorResult('INVALID_ARGUMENT', `${options.resourceIdArgName} is required`);
  }

  const elicitationError = requireFormElicitation(server, ctx.serverContext);
  if (elicitationError) {
    return elicitationError;
  }
  const serverContext = ctx.serverContext as ServerContext;

  let scopedArgs: ScopedDestructiveArgs;
  try {
    const scope = resolveProjectScope({
      projectUuid: typeof argsRecord.projectUuid === 'string' ? argsRecord.projectUuid : undefined,
    });
    scopedArgs = { projectUuid: scope.projectUuid, resourceId };
  } catch (err) {
    return projectScopeErrorResult(err);
  }

  const declineOrCancel = declineOrCancelIfPresent(serverContext, spec, scopedArgs);
  if (declineOrCancel) {
    return declineOrCancel;
  }

  const accepted = acceptedContent<DeleteConfirmFormContent>(
    serverContext.mcpReq.inputResponses,
    CONFIRM_INPUT_KEY,
  );
  const boundState = await readBoundRequestState(serverContext);
  if (accepted && boundState) {
    return applyAcceptedDelete({ spec, scopedArgs, boundState, accepted, ctx });
  }

  return requestDeleteConfirmation(spec, scopedArgs, ctx, serverContext);
}

/**
 * Register a soft-delete tool that requires form elicitation before calling Lightdash DELETE.
 */
export function registerDestructiveDeleteTool<TSnapshot>(
  server: McpServer,
  shortName: string,
  options: RegisterDestructiveDeleteOptions,
  contextProvider: McpContextProvider,
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
): void {
  const inputSchema: ToolOptions['inputSchema'] = {
    projectUuid: projectUuidField().optional(),
    [options.resourceIdArgName]: options.resourceIdField,
  };

  registerToolSafe(
    server,
    shortName,
    {
      title: options.title,
      description: options.description,
      annotations: {
        ...(options.annotations ?? WRITE_DESTRUCTIVE),
        // Soft-delete retries for the same bound identity are safe when already deleted.
        idempotentHint: true,
      },
      inputSchema,
    },
    wrapToolContextual(
      contextProvider,
      (ctx) => async (rawArgs) => handleDestructiveDelete(server, options, spec, ctx, rawArgs),
    ),
  );
}
