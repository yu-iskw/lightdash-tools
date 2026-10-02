/**
 * Fault tests for create_project_agent preview tokens (ADR-0034).
 */

import { digestCreateAgentPayload } from '@lightdash-tools/common';
import { afterEach, describe, expect, it } from 'vitest';

import {
  confirmCreateAgentPreviewToken,
  mintDraftCreateAgentPreviewToken,
  resetCreateAgentPreviewCodecForTests,
  withValidatedCreateAgentApply,
} from './create-agent-preview.js';

import type { ServerContext } from '@modelcontextprotocol/server';

const PROJECT = '11111111-1111-1111-1111-111111111111';
const SUBJECT = 'anonymous';

const PAYLOAD = { name: 'Analyst', enableDataAccess: true };

function digest(): string {
  return digestCreateAgentPayload(PAYLOAD);
}

describe('create-agent preview tokens', () => {
  afterEach(() => {
    resetCreateAgentPreviewCodecForTests();
  });

  it('rejects invalid createPreviewToken at confirm → CREATE_PREVIEW_REQUIRED', async () => {
    await expect(
      confirmCreateAgentPreviewToken({
        createPreviewToken: 'not-a-valid-token',
        subject: SUBJECT,
        projectUuid: PROJECT,
        agentName: PAYLOAD.name,
      }),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_REQUIRED' });
  });

  it('rejects empty createPreviewToken at confirm → CREATE_PREVIEW_REQUIRED', async () => {
    await expect(
      confirmCreateAgentPreviewToken({
        createPreviewToken: '',
        subject: SUBJECT,
        projectUuid: PROJECT,
        agentName: PAYLOAD.name,
      }),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_REQUIRED' });
  });

  it('rejects wrong subject at confirm → CREATE_PREVIEW_NOT_OWNED', async () => {
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    });
    await expect(
      confirmCreateAgentPreviewToken({
        createPreviewToken,
        subject: 'other-subject',
        projectUuid: PROJECT,
        agentName: PAYLOAD.name,
      }),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_NOT_OWNED' });
  });

  it('rejects wrong project at confirm → CREATE_PREVIEW_NOT_OWNED', async () => {
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    });
    await expect(
      confirmCreateAgentPreviewToken({
        createPreviewToken,
        subject: SUBJECT,
        projectUuid: '22222222-2222-2222-2222-222222222222',
        agentName: PAYLOAD.name,
      }),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_NOT_OWNED' });
  });

  it('rejects wrong agent name at confirm → CREATE_PREVIEW_STALE', async () => {
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    });
    await expect(
      confirmCreateAgentPreviewToken({
        createPreviewToken,
        subject: SUBJECT,
        projectUuid: PROJECT,
        agentName: 'Renamed',
      }),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_STALE' });
  });

  it('digest mismatch at apply → CREATE_PREVIEW_STALE', async () => {
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    });
    const { createConfirmToken } = await confirmCreateAgentPreviewToken({
      createPreviewToken,
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
    });
    await expect(
      withValidatedCreateAgentApply(
        {
          createConfirmToken,
          subject: SUBJECT,
          projectUuid: PROJECT,
          agentName: PAYLOAD.name,
          payloadDigest: digestCreateAgentPayload({ name: PAYLOAD.name, enableDataAccess: false }),
        },
        async () => 'ok',
      ),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_STALE' });
  });

  it('draft token at apply → CREATE_PREVIEW_NOT_VALIDATED', async () => {
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    });
    await expect(
      withValidatedCreateAgentApply(
        {
          createConfirmToken: createPreviewToken,
          subject: SUBJECT,
          projectUuid: PROJECT,
          agentName: PAYLOAD.name,
          payloadDigest: digest(),
        },
        async () => 'ok',
      ),
    ).rejects.toMatchObject({ code: 'CREATE_PREVIEW_NOT_VALIDATED' });
  });

  it('confirm then apply succeeds', async () => {
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
      serverContext: { mcpReq: {} } as ServerContext,
    });
    const { createConfirmToken } = await confirmCreateAgentPreviewToken({
      createPreviewToken,
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      serverContext: { mcpReq: {} } as ServerContext,
    });
    const result = await withValidatedCreateAgentApply(
      {
        createConfirmToken,
        subject: SUBJECT,
        projectUuid: PROJECT,
        agentName: PAYLOAD.name,
        payloadDigest: digest(),
        serverContext: { mcpReq: {} } as ServerContext,
      },
      async (claims) => claims.previewId,
    );
    expect(result).toEqual(expect.any(String));
  });

  it('validated createConfirmToken can be applied multiple times (no server-side single-use)', async () => {
    // HMAC tokens are client-carried and stateless (ADR-0019); single-use would require server-side claim store.
    const { createPreviewToken } = await mintDraftCreateAgentPreviewToken({
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    });
    const { createConfirmToken } = await confirmCreateAgentPreviewToken({
      createPreviewToken,
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
    });
    const applyInput = {
      createConfirmToken,
      subject: SUBJECT,
      projectUuid: PROJECT,
      agentName: PAYLOAD.name,
      payloadDigest: digest(),
    };
    await expect(withValidatedCreateAgentApply(applyInput, async () => 1)).resolves.toBe(1);
    await expect(withValidatedCreateAgentApply(applyInput, async () => 2)).resolves.toBe(2);
  });
});
