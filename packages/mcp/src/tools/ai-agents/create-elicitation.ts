/**
 * Form elicitation gate for create_project_agent (ADR-0033 / ADR-0015 pattern).
 */

import {
  digestCreateAgentPayload,
  formatAgentPermissionSummary,
  type AgentCreatePayloadFields,
} from '@lightdash-tools/common';
import { acceptedContent, inputRequired, inputResponse } from '@modelcontextprotocol/server';

import { jsonToolResult, withAuditStatus, withLightdashBlockedMarker } from '../shared.js';

import {
  CREATE_PROJECT_AGENT_OPERATION_ID,
  mintCreateAgentRequestState,
  verifyCreateAgentRequestState,
  type CreateAgentRequestState,
} from './create-request-state.js';
import { effectiveAgentTags, previewExploreCountForTags } from './tag-warnings.js';

import type { ToolExecutionContext, ToolResult } from '../shared.js';
import type { ExploreAccessSummaryClient } from './tag-warnings.js';
import type { McpServer, ServerContext } from '@modelcontextprotocol/server';

export { digestCreateAgentPayload, previewExploreCountForTags };

export const CONFIRM_CREATE_AGENT_INPUT_KEY = 'confirm_create_agent' as const;

export type CreateAgentConfirmFormContent = {
  decision: 'confirm_create' | 'do_not_create';
};

export const CREATE_AGENT_CONFIRM_FORM_SCHEMA = {
  type: 'object' as const,
  properties: {
    decision: {
      type: 'string' as const,
      title: 'Create AI agent?',
      description: 'Creates a new Lightdash AI agent in this project (not idempotent).',
      enum: ['confirm_create', 'do_not_create'],
      enumNames: ['Create agent', 'Do not create'],
      default: 'do_not_create',
    },
  },
  required: ['decision'],
};

function appendTagPreviewLines(
  lines: string[],
  tags: string[] | null | undefined,
  exploreCount: number | null,
): void {
  const effective = effectiveAgentTags(tags);
  if (effective === undefined) {
    lines.push('Tags: (none — agent can access all project explores)');
    return;
  }
  lines.push(`Tags: ${effective.join(', ')}`);
  if (exploreCount === null) {
    lines.push('Explore access preview: unavailable (summary call failed)');
    return;
  }
  if (exploreCount === 0) {
    lines.push(
      'Explore access preview: 0 explores — agent will see no data model with these tags.',
    );
    return;
  }
  lines.push(`Explore access preview: ${exploreCount} explore(s) match these tags`);
}

export function buildCreateAgentConfirmationMessage(input: {
  name: string;
  payload: AgentCreatePayloadFields;
  tags: string[] | null | undefined;
  exploreCount: number | null;
}): string {
  const lines = [
    'Confirm creation of a new Lightdash AI agent.',
    `Name: ${input.name}`,
    'Permissions:',
    ...formatAgentPermissionSummary(input.payload, {
      groupAccess: input.payload.groupAccess,
      userAccess: input.payload.userAccess,
    }),
  ];
  appendTagPreviewLines(lines, input.tags, input.exploreCount);
  lines.push('Choose Create agent to proceed, or Do not create to cancel.');
  return lines.join('\n');
}

function elicitationRequiredResult(message: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'ELICITATION_REQUIRED',
      message,
      created: false,
    }),
  );
}

function confirmationInvalidResult(message: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'CONFIRMATION_INVALID',
      message,
      created: false,
    }),
  );
}

function declinedCreateResult(projectUuid: string): ToolResult {
  return withAuditStatus(
    jsonToolResult({
      status: 'declined',
      created: false,
      operation: CREATE_PROJECT_AGENT_OPERATION_ID,
      projectUuid,
    }),
    'confirmation_declined',
  );
}

function cancelledCreateResult(projectUuid: string): ToolResult {
  return withAuditStatus(
    jsonToolResult({
      status: 'cancelled',
      created: false,
      operation: CREATE_PROJECT_AGENT_OPERATION_ID,
      projectUuid,
    }),
    'confirmation_cancelled',
  );
}

function requireElicitationServerContext(
  serverContext: ServerContext | undefined,
): ToolResult | undefined {
  if (!serverContext) {
    return elicitationRequiredResult('Missing MCP ServerContext required for elicitation.');
  }
  return undefined;
}

async function readBoundCreateRequestState(
  serverContext: ServerContext,
): Promise<CreateAgentRequestState | undefined> {
  const mcpReq = serverContext.mcpReq as {
    requestState?: string | (() => unknown);
  };
  const raw =
    typeof mcpReq.requestState === 'function' ? mcpReq.requestState() : mcpReq.requestState;
  if (typeof raw === 'string') {
    return verifyCreateAgentRequestState(raw, serverContext);
  }
  if (
    raw &&
    typeof raw === 'object' &&
    'payloadDigest' in raw &&
    'operationId' in raw &&
    (raw as CreateAgentRequestState).operationId === CREATE_PROJECT_AGENT_OPERATION_ID
  ) {
    return raw as CreateAgentRequestState;
  }
  return undefined;
}

function bindingMatchesCreate(
  boundState: CreateAgentRequestState,
  projectUuid: string,
  subject: string,
  payloadDigest: string,
): boolean {
  return (
    boundState.operationId === CREATE_PROJECT_AGENT_OPERATION_ID &&
    boundState.projectUuid === projectUuid &&
    boundState.subject === subject &&
    boundState.payloadDigest === payloadDigest
  );
}

function resolveAcceptedCreateDecision(
  accepted: CreateAgentConfirmFormContent,
  projectUuid: string,
): { proceed: false; result: ToolResult } | { proceed: true } {
  if (accepted.decision === 'do_not_create') {
    return { proceed: false, result: declinedCreateResult(projectUuid) };
  }
  if (accepted.decision !== 'confirm_create') {
    return {
      proceed: false,
      result: confirmationInvalidResult('Confirmation was not accepted for create_project_agent.'),
    };
  }
  return { proceed: true };
}

async function mintCreateInputRequired(input: {
  serverContext: ServerContext;
  projectUuid: string;
  payload: AgentCreatePayloadFields;
  payloadDigest: string;
  subject: string;
  exploreAccessClient: ExploreAccessSummaryClient;
}): Promise<ToolResult> {
  const exploreCount = await previewExploreCountForTags(
    input.exploreAccessClient,
    input.projectUuid,
    input.payload.tags,
  );
  const stateToken = await mintCreateAgentRequestState(
    {
      operationId: CREATE_PROJECT_AGENT_OPERATION_ID,
      projectUuid: input.projectUuid,
      payloadDigest: input.payloadDigest,
      subject: input.subject,
    },
    input.serverContext,
  );
  return inputRequired({
    requestState: stateToken,
    inputRequests: {
      [CONFIRM_CREATE_AGENT_INPUT_KEY]: inputRequired.elicit({
        mode: 'form',
        message: buildCreateAgentConfirmationMessage({
          name: input.payload.name,
          payload: input.payload,
          tags: input.payload.tags,
          exploreCount,
        }),
        requestedSchema: CREATE_AGENT_CONFIRM_FORM_SCHEMA,
      }),
    },
  });
}

/**
 * Run the create elicitation gate. Returns:
 * - ToolResult to return immediately (blocked / input required / declined), or
 * - `{ proceed: true }` when the human accepted and the digest matches.
 */
export async function gateCreateProjectAgentElicitation(input: {
  server: McpServer;
  ctx: ToolExecutionContext;
  projectUuid: string;
  payload: AgentCreatePayloadFields;
  exploreAccessClient: ExploreAccessSummaryClient;
}): Promise<{ proceed: false; result: ToolResult } | { proceed: true }> {
  const { ctx, projectUuid, payload, exploreAccessClient } = input;
  const elicitationError = requireElicitationServerContext(ctx.serverContext);
  if (elicitationError) {
    return { proceed: false, result: elicitationError };
  }
  const serverContext = ctx.serverContext as ServerContext;

  const responseView = inputResponse(
    serverContext.mcpReq.inputResponses,
    CONFIRM_CREATE_AGENT_INPUT_KEY,
  );
  if (responseView.kind === 'elicit' && responseView.action === 'decline') {
    return { proceed: false, result: declinedCreateResult(projectUuid) };
  }
  if (responseView.kind === 'elicit' && responseView.action === 'cancel') {
    return { proceed: false, result: cancelledCreateResult(projectUuid) };
  }

  const payloadDigest = digestCreateAgentPayload(payload);
  const accepted = acceptedContent<CreateAgentConfirmFormContent>(
    serverContext.mcpReq.inputResponses,
    CONFIRM_CREATE_AGENT_INPUT_KEY,
  );
  const boundState = await readBoundCreateRequestState(serverContext);

  if (accepted && boundState) {
    if (!bindingMatchesCreate(boundState, projectUuid, ctx.subject, payloadDigest)) {
      return {
        proceed: false,
        result: confirmationInvalidResult(
          'Confirmation binding does not match this create_project_agent request.',
        ),
      };
    }
    return resolveAcceptedCreateDecision(accepted, projectUuid);
  }

  return {
    proceed: false,
    result: await mintCreateInputRequired({
      serverContext,
      projectUuid,
      payload,
      payloadDigest,
      subject: ctx.subject,
      exploreAccessClient,
    }),
  };
}
