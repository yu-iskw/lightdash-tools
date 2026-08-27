/**
 * Dual-gate orchestrator for create_project_agent (ADR-0033 form + ADR-0034 preview-token).
 */

import { supportsFormElicitation } from '../../destructive/capability.js';
import {
  CreateAgentPreviewError,
  verifyValidatedCreateConfirmToken,
} from '../../policy/create-agent-preview.js';
import { jsonToolResult, withLightdashBlockedMarker } from '../shared.js';

import {
  digestCreateAgentPayload,
  gateCreateProjectAgentElicitation,
} from './create-elicitation.js';

import type { ToolExecutionContext, ToolResult } from '../shared.js';
import type { ExploreAccessSummaryClient } from './tag-warnings.js';
import type { AgentCreatePayloadFields } from '@lightdash-tools/common';
import type { ClientCapabilities, McpServer, ServerContext } from '@modelcontextprotocol/server';

const PREVIEW_REQUIRED_MESSAGE =
  'create_project_agent requires confirmation. When the client lacks MCP form elicitation, ' +
  'call preview_create_agent, obtain human approval for the permission summary, then ' +
  'confirm_create_agent, and retry create_project_agent with the same payload and createConfirmToken.';

function previewRequiredResult(message: string = PREVIEW_REQUIRED_MESSAGE): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code: 'PREVIEW_REQUIRED',
      message,
      created: false,
    }),
  );
}

function previewBlockedResult(code: string, message: string): ToolResult {
  return withLightdashBlockedMarker(
    jsonToolResult({
      status: 'blocked',
      code,
      message,
      created: false,
    }),
  );
}

/**
 * Run create confirmation gate. Order:
 * 1. Form elicitation when the client supports it (ADR-0033).
 * 2. Preview-token apply when createConfirmToken is supplied (ADR-0034).
 * 3. PREVIEW_REQUIRED when neither applies.
 */
export async function gateCreateProjectAgent(input: {
  server: McpServer;
  ctx: ToolExecutionContext;
  projectUuid: string;
  payload: AgentCreatePayloadFields;
  exploreAccessClient: ExploreAccessSummaryClient;
  createConfirmToken?: string;
}): Promise<{ proceed: false; result: ToolResult } | { proceed: true }> {
  const { server, ctx, projectUuid, payload, exploreAccessClient, createConfirmToken } = input;
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- 2025-era fallback
  const initializeCaps = server.server.getClientCapabilities() as ClientCapabilities | undefined;

  if (supportsFormElicitation(ctx.serverContext, initializeCaps)) {
    return gateCreateProjectAgentElicitation({
      server,
      ctx,
      projectUuid,
      payload,
      exploreAccessClient,
    });
  }

  if (createConfirmToken === undefined || createConfirmToken.length === 0) {
    return { proceed: false, result: previewRequiredResult() };
  }

  const payloadDigest = digestCreateAgentPayload(payload);
  try {
    await verifyValidatedCreateConfirmToken({
      createConfirmToken,
      subject: ctx.subject,
      projectUuid,
      agentName: payload.name,
      payloadDigest,
      serverContext: ctx.serverContext as ServerContext | undefined,
    });
    return { proceed: true };
  } catch (err) {
    if (err instanceof CreateAgentPreviewError) {
      return { proceed: false, result: previewBlockedResult(err.code, err.message) };
    }
    throw err;
  }
}
