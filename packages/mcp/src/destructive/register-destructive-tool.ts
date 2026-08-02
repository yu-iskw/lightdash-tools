/**
 * Central wrapper for elicitation-gated mutation MCP tools (ADR-0015 / ADR-0017).
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
  claimConfirmationKey,
  confirmationClaimKey,
  releaseConfirmationKey,
} from './confirmation-claim.js';
import {
  buildDeleteConfirmationMessage,
  DELETE_CONFIRM_FORM_SCHEMA,
  isAcceptedDeleteForm,
  type ConfirmFormSchema,
  type DeleteConfirmFormContent,
} from './confirmation.js';
import { mintDestructiveRequestState, verifyDestructiveRequestState } from './request-state.js';
import {
  CONFIRM_INPUT_KEY,
  type DestructiveOperationSpec,
  type DestructiveRequestState,
  type ElicitationGateLabels,
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

export type ElicitationFormConfig<TForm extends { confirmationText: string }> = {
  inputKey: string;
  formSchema: ConfirmFormSchema;
  buildMessage: (
    target: ReturnType<DestructiveOperationSpec<ScopedDestructiveArgs, unknown>['summarizeTarget']>,
  ) => string;
  isAcceptedForm: (content: TForm | undefined, expectedName: string) => content is TForm;
};

export type RegisterElicitationGatedOptions = RegisterDestructiveDeleteOptions & {
  /** When true, soft-delete-style retries are marked idempotent. */
  idempotentHint?: boolean;
};

type ElicitationGateBundle<TSnapshot, TForm extends { confirmationText: string }> = {
  options: RegisterElicitationGatedOptions;
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>;
  form: ElicitationFormConfig<TForm>;
  labels: ElicitationGateLabels;
};

const DELETE_GATE_LABELS: ElicitationGateLabels = {
  operation: 'delete',
  successStatus: 'deleted',
  successAudit: 'deletion_succeeded',
  failureCode: 'DELETION_FAILED',
  failureMessage: 'Soft-delete failed. Retry after reviewing the resource, or check server logs.',
  failureAudit: 'deletion_failed',
  bindingMismatchMessage: 'Confirmation binding does not match this delete request.',
  acceptMismatchMessage: 'Confirmation was not accepted, or the typed resource name did not match.',
  resourceChangedMessage:
    'The resource changed after confirmation was requested. Review it and confirm again.',
  elicitationRequiredMessage:
    'This destructive operation requires an MCP client that supports form elicitation.',
};

export const PROMOTE_GATE_LABELS: ElicitationGateLabels = {
  operation: 'promote',
  successStatus: 'promoted',
  successAudit: 'promotion_succeeded',
  failureCode: 'PROMOTION_FAILED',
  failureMessage:
    'Dashboard promote failed. Retry after reviewing promoteDiff, or check server logs.',
  failureAudit: 'promotion_failed',
  bindingMismatchMessage: 'Confirmation binding does not match this promote request.',
  acceptMismatchMessage:
    'Confirmation was not accepted, or the typed dashboard name did not match.',
  resourceChangedMessage:
    'The dashboard or promotion diff changed after confirmation was requested. Review it and confirm again.',
  elicitationRequiredMessage:
    'Dashboard promote requires an MCP client that supports form elicitation.',
};

async function readBoundRequestState(
  serverContext: ServerContext,
): Promise<DestructiveRequestState | undefined> {
  const mcpReq = serverContext.mcpReq as {
    requestState?: string | (() => unknown);
  };
  const raw =
    typeof mcpReq.requestState === 'function' ? mcpReq.requestState() : mcpReq.requestState;
  // HMAC-signed opaque token (not encrypted): verify via codec.
  if (typeof raw === 'string') {
    return verifyDestructiveRequestState(raw, serverContext);
  }
  // 2025-era SDK legacy elicitation shim may echo the decoded payload object.
  if (raw && typeof raw === 'object' && 'preconditionDigest' in raw && 'operationId' in raw) {
    return raw as DestructiveRequestState;
  }
  return undefined;
}

function confirmationInvalidResult(message: string, mutatedFlag: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'CONFIRMATION_INVALID',
      message,
      [mutatedFlag]: false,
    }),
  );
}

function elicitationRequiredResult(message: string, mutatedFlag: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'ELICITATION_REQUIRED',
      message,
      [mutatedFlag]: false,
    }),
  );
}

function mutatedFlagFor(operation: ElicitationGateLabels['operation']): string {
  return operation === 'delete' ? 'deleted' : 'promoted';
}

function declinedOrCancelledResult<TSnapshot>(
  action: 'cancelled' | 'declined',
  auditStatus: 'confirmation_cancelled' | 'confirmation_declined',
  labels: ElicitationGateLabels,
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
): ToolResult {
  const flag = mutatedFlagFor(labels.operation);
  return withAuditStatus(
    jsonToolResult({
      status: action,
      [flag]: false,
      operation: labels.operation,
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

async function applyAcceptedMutation<TSnapshot, TForm extends { confirmationText: string }>(input: {
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>;
  scopedArgs: ScopedDestructiveArgs;
  boundState: DestructiveRequestState;
  accepted: TForm;
  ctx: ToolExecutionContext;
  form: ElicitationFormConfig<TForm>;
  labels: ElicitationGateLabels;
}): Promise<ToolResult> {
  const { spec, scopedArgs, boundState, accepted, ctx, form, labels } = input;
  const flag = mutatedFlagFor(labels.operation);
  if (!bindingMatches(boundState, spec, scopedArgs, ctx.sessionId)) {
    return confirmationInvalidResult(labels.bindingMismatchMessage, flag);
  }

  if (!form.isAcceptedForm(accepted, boundState.resourceName)) {
    return confirmationInvalidResult(labels.acceptMismatchMessage, flag);
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
          message: labels.resourceChangedMessage,
          [flag]: false,
        }),
      ),
      'resource_changed',
    );
  }

  // Promote is non-idempotent: consume confirmation before execute to block concurrent replay.
  const claimKey = labels.operation === 'promote' ? confirmationClaimKey(boundState) : undefined;
  if (claimKey !== undefined && !claimConfirmationKey(claimKey)) {
    return withAuditStatus(
      withLightdashBlockedMarker(
        jsonToolResult({
          status: 'blocked',
          code: 'CONFIRMATION_REPLAY',
          message:
            'This promote confirmation was already used. Re-run promote_dashboard for a fresh confirmation.',
          [flag]: false,
        }),
      ),
      'blocked',
    );
  }

  let executeExtra: Record<string, unknown> | void;
  try {
    executeExtra = await spec.execute(scopedArgs, snapshot, ctx);
  } catch {
    if (claimKey !== undefined) {
      releaseConfirmationKey(claimKey);
    }
    // Do not echo upstream/API exception text to MCP clients or unbounded stderr.
    process.stderr.write(
      `[lightdash-mcp] ${labels.operation} failed for ${spec.resourceType} ${scopedArgs.resourceId} (${labels.failureCode})\n`,
    );
    return withAuditStatus(
      jsonToolResult({
        status: 'error',
        [flag]: false,
        code: labels.failureCode,
        message: labels.failureMessage,
        operation: labels.operation,
        resourceType: spec.resourceType,
        resourceId: scopedArgs.resourceId,
        projectUuid: scopedArgs.projectUuid,
      }),
      labels.failureAudit,
    );
  }

  const target = spec.summarizeTarget(snapshot);
  const completedAt = new Date().toISOString();
  return withAuditStatus(
    jsonToolResult({
      status: labels.successStatus,
      operation: labels.operation,
      resourceType: target.resourceType,
      resourceId: target.resourceId,
      resourceName: target.resourceName,
      projectUuid: target.projectUuid,
      confirmation: { mode: 'form', action: 'accept' },
      ...(labels.operation === 'delete'
        ? { deletedAt: completedAt }
        : { promoted: true, promotedAt: completedAt }),
      ...(executeExtra ?? {}),
    }),
    labels.successAudit,
  );
}

function requireFormElicitation(
  server: McpServer,
  serverContext: ServerContext | undefined,
  labels: ElicitationGateLabels,
): ToolResult | undefined {
  // 2026: per-request envelope; 2025: initialize-declared caps via Server.
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- 2025-era fallback; envelope preferred in capability.ts
  const initializeCaps = server.server.getClientCapabilities() as ClientCapabilities | undefined;
  if (!supportsFormElicitation(serverContext, initializeCaps)) {
    return elicitationRequiredResult(
      labels.elicitationRequiredMessage,
      mutatedFlagFor(labels.operation),
    );
  }
  if (!serverContext) {
    return elicitationRequiredResult(
      'Missing MCP ServerContext required for elicitation.',
      mutatedFlagFor(labels.operation),
    );
  }
  return undefined;
}

function declineOrCancelIfPresent<TSnapshot>(
  serverContext: ServerContext,
  inputKey: string,
  labels: ElicitationGateLabels,
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
): ToolResult | undefined {
  const responseView = inputResponse(serverContext.mcpReq.inputResponses, inputKey);
  if (responseView.kind === 'elicit' && responseView.action === 'decline') {
    return declinedOrCancelledResult('declined', 'confirmation_declined', labels, spec, scopedArgs);
  }
  if (responseView.kind === 'elicit' && responseView.action === 'cancel') {
    return declinedOrCancelledResult(
      'cancelled',
      'confirmation_cancelled',
      labels,
      spec,
      scopedArgs,
    );
  }
  return undefined;
}

async function requestConfirmation<TSnapshot, TForm extends { confirmationText: string }>(
  spec: DestructiveOperationSpec<ScopedDestructiveArgs, TSnapshot>,
  scopedArgs: ScopedDestructiveArgs,
  ctx: ToolExecutionContext,
  serverContext: ServerContext,
  form: ElicitationFormConfig<TForm>,
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
      [form.inputKey]: inputRequired.elicit({
        mode: 'form',
        message: form.buildMessage(target),
        requestedSchema: form.formSchema,
      }),
    },
  });
}

async function handleElicitationGatedMutation<
  TSnapshot,
  TForm extends { confirmationText: string },
>(
  server: McpServer,
  ctx: ToolExecutionContext,
  rawArgs: unknown,
  gate: ElicitationGateBundle<TSnapshot, TForm>,
): Promise<ToolResult> {
  const { options, spec, form, labels } = gate;
  const argsRecord = rawArgs as Record<string, unknown>;
  const resourceId = argsRecord[options.resourceIdArgName];
  if (typeof resourceId !== 'string' || resourceId.length === 0) {
    return codedErrorResult('INVALID_ARGUMENT', `${options.resourceIdArgName} is required`);
  }

  const elicitationError = requireFormElicitation(server, ctx.serverContext, labels);
  if (elicitationError) {
    return elicitationError;
  }
  const serverContext = ctx.serverContext as ServerContext;

  let scopedArgs: ScopedDestructiveArgs;
  try {
    const scope = resolveProjectScope(
      {
        projectUuid:
          typeof argsRecord.projectUuid === 'string' ? argsRecord.projectUuid : undefined,
      },
      { allowConfiguredEnv: false },
    );
    scopedArgs = { projectUuid: scope.projectUuid, resourceId };
  } catch (err) {
    return projectScopeErrorResult(err);
  }

  const declineOrCancel = declineOrCancelIfPresent(
    serverContext,
    form.inputKey,
    labels,
    spec,
    scopedArgs,
  );
  if (declineOrCancel) {
    return declineOrCancel;
  }

  const accepted = acceptedContent<TForm>(serverContext.mcpReq.inputResponses, form.inputKey);
  const boundState = await readBoundRequestState(serverContext);
  if (accepted && boundState) {
    return applyAcceptedMutation({
      spec,
      scopedArgs,
      boundState,
      accepted,
      ctx,
      form,
      labels,
    });
  }

  return requestConfirmation(spec, scopedArgs, ctx, serverContext, form);
}

/**
 * Register a mutation tool that requires form elicitation before calling Lightdash.
 */
export function registerElicitationGatedTool<TSnapshot, TForm extends { confirmationText: string }>(
  server: McpServer,
  shortName: string,
  contextProvider: McpContextProvider,
  gate: ElicitationGateBundle<TSnapshot, TForm>,
): void {
  const { options } = gate;
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
        ...(options.idempotentHint === true ? { idempotentHint: true } : {}),
      },
      inputSchema,
    },
    wrapToolContextual(
      contextProvider,
      (ctx) => async (rawArgs) => handleElicitationGatedMutation(server, ctx, rawArgs, gate),
    ),
  );
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
  registerElicitationGatedTool<TSnapshot, DeleteConfirmFormContent>(
    server,
    shortName,
    contextProvider,
    {
      options: { ...options, idempotentHint: true },
      spec,
      form: {
        inputKey: CONFIRM_INPUT_KEY,
        formSchema: DELETE_CONFIRM_FORM_SCHEMA,
        buildMessage: buildDeleteConfirmationMessage,
        isAcceptedForm: isAcceptedDeleteForm,
      },
      labels: DELETE_GATE_LABELS,
    },
  );
}
