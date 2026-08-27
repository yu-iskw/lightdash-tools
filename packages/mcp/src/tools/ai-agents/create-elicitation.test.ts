/**
 * Unit tests for agent tag soft warnings and create_project_agent elicitation.
 */

import { CLIENT_CAPABILITIES_META_KEY, isInputRequiredResult } from '@modelcontextprotocol/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCreateAgentPreviewCodecForTests } from '../../policy/create-agent-preview.js';

import {
  registerConfirmCreateAgent,
  registerCreateProjectAgent,
  registerPreviewCreateAgent,
  registerUpdateProjectAgent,
} from './agents.js';
import {
  CONFIRM_CREATE_AGENT_INPUT_KEY,
  digestCreateAgentPayload,
  buildCreateAgentConfirmationMessage,
} from './create-elicitation.js';
import {
  getCreateAgentRequestStateCodec,
  mintCreateAgentRequestState,
  resetCreateAgentRequestStateCodecForTests,
} from './create-request-state.js';
import { warningsForAgentTags } from './tag-warnings.js';
import {
  mockAiAgentsContext,
  parseAiAgentToolBody,
  registeredAiAgentTool,
} from './test-support.js';

import type { ToolHandler } from '../shared.js';
import type { ServerContext } from '@modelcontextprotocol/server';

const PROJECT = '11111111-1111-1111-1111-111111111111';
const AGENT = '22222222-2222-2222-2222-222222222222';

function formCapsServerContext(
  overrides: {
    inputResponses?: unknown;
    requestState?: string | (() => unknown);
  } = {},
): ServerContext {
  return {
    mcpReq: {
      envelope: {
        [CLIENT_CAPABILITIES_META_KEY]: { elicitation: { form: {} } },
      },
      inputResponses: overrides.inputResponses,
      requestState:
        overrides.requestState === undefined
          ? () => undefined
          : typeof overrides.requestState === 'function'
            ? overrides.requestState
            : () => overrides.requestState,
    },
  } as unknown as ServerContext;
}

describe('warningsForAgentTags', () => {
  it('skips when tags are null or empty', async () => {
    const getExploreAccessSummary = vi.fn();
    expect(await warningsForAgentTags({ getExploreAccessSummary }, PROJECT, null)).toEqual([]);
    expect(await warningsForAgentTags({ getExploreAccessSummary }, PROJECT, [])).toEqual([]);
    expect(getExploreAccessSummary).not.toHaveBeenCalled();
  });

  it('returns TAGS_MATCH_NO_EXPLORES when summary is empty', async () => {
    const getExploreAccessSummary = vi.fn().mockResolvedValue([]);
    const warnings = await warningsForAgentTags({ getExploreAccessSummary }, PROJECT, [
      'no-such-tag',
    ]);
    expect(warnings).toEqual([expect.objectContaining({ code: 'TAGS_MATCH_NO_EXPLORES' })]);
    expect(getExploreAccessSummary).toHaveBeenCalledWith(PROJECT, { tags: ['no-such-tag'] });
  });

  it('returns no warning when explores match', async () => {
    const getExploreAccessSummary = vi.fn().mockResolvedValue([{ exploreName: 'orders' }]);
    const warnings = await warningsForAgentTags({ getExploreAccessSummary }, PROJECT, ['ai']);
    expect(warnings).toEqual([]);
  });

  it('returns EXPLORE_ACCESS_SUMMARY_UNAVAILABLE when summary throws', async () => {
    const getExploreAccessSummary = vi.fn().mockRejectedValue(new Error('upstream down'));
    const warnings = await warningsForAgentTags({ getExploreAccessSummary }, PROJECT, ['ai']);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'EXPLORE_ACCESS_SUMMARY_UNAVAILABLE',
        message: expect.stringContaining('upstream down'),
      }),
    ]);
  });
});

describe('create elicitation helpers', () => {
  it('digests are stable under tag reordering', () => {
    const a = digestCreateAgentPayload({ name: 'A', tags: ['b', 'a'], enableDataAccess: true });
    const b = digestCreateAgentPayload({ name: 'A', tags: ['a', 'b'], enableDataAccess: true });
    expect(a).toBe(b);
  });

  it('normalizes empty tags to the same digest as omitted tags', () => {
    const omitted = digestCreateAgentPayload({ name: 'A' });
    const empty = digestCreateAgentPayload({ name: 'A', tags: [] });
    expect(empty).toBe(omitted);
  });

  it('buildCreateAgentConfirmationMessage flags zero explores and shows permissions', () => {
    const payload = { name: 'Analyst', enableDataAccess: true, tags: ['missing'] as string[] };
    const msg = buildCreateAgentConfirmationMessage({
      name: 'Analyst',
      payload,
      tags: ['missing'],
      exploreCount: 0,
      spaceAccessValidation: { skipped: true },
    });
    expect(msg).toMatch(/0 explores/);
    expect(msg).toMatch(/Analyst/);
    expect(msg).toMatch(/Permissions:/);
    expect(msg).toMatch(/Read rows behind chart: on/);
    expect(msg).toMatch(/all project spaces/);
  });

  it('buildCreateAgentConfirmationMessage shows resolved space names', () => {
    const spaceUuid = '00000000-0000-4000-8000-000000000040';
    const payload = { name: 'Analyst', spaceAccess: [spaceUuid] };
    const msg = buildCreateAgentConfirmationMessage({
      name: 'Analyst',
      payload,
      tags: null,
      exploreCount: null,
      spaceAccessValidation: {
        resolved: [{ uuid: spaceUuid, name: 'Finance' }],
        unknownUuids: [],
      },
    });
    expect(msg).toMatch(/Finance/);
    expect(msg).toMatch(/1 space\(s\)/);
  });

  it('minimal payload digest uses secure defaults', () => {
    const minimal = digestCreateAgentPayload({ name: 'Smoke' });
    const explicit = digestCreateAgentPayload({
      name: 'Smoke',
      enableDataAccess: false,
      enableContentTools: false,
      enableSqlMode: false,
      enableUserContext: false,
      adminOnly: true,
      enableSelfImprovement: false,
    });
    expect(minimal).toBe(explicit);
  });
});

describe('create_project_agent elicitation', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetCreateAgentRequestStateCodecForTests();
    resetCreateAgentPreviewCodecForTests();
  });

  it('blocks with PREVIEW_REQUIRED when form elicitation is missing', async () => {
    const createAgent = vi.fn();
    const getExploreAccessSummary = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      {
        registerTool: vi.fn(),
        server: { getClientCapabilities: () => ({}) },
      } as never,
    );

    const result = await handler(
      { projectUuid: PROJECT, name: 'Analyst', enableDataAccess: true },
      { mcpReq: { envelope: {}, inputResponses: undefined, requestState: () => undefined } },
    );
    expect(createAgent).not.toHaveBeenCalled();
    const body = parseAiAgentToolBody(result);
    expect(body.code).toBe('PREVIEW_REQUIRED');
    expect(body.created).toBe(false);
  });

  it('creates via preview-token path when createConfirmToken is validated', async () => {
    resetCreateAgentPreviewCodecForTests();
    process.env.NODE_ENV = 'test';

    const createAgent = vi.fn().mockResolvedValue({ uuid: AGENT, name: 'Analyst' });
    const getExploreAccessSummary = vi.fn().mockResolvedValue([{ exploreName: 'orders' }]);
    const { handler: previewHandler } = registeredAiAgentTool(
      registerPreviewCreateAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'preview_create_agent',
      { registerTool: vi.fn(), server: { getClientCapabilities: () => ({}) } } as never,
    );
    const { handler: confirmHandler } = registeredAiAgentTool(
      registerConfirmCreateAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'confirm_create_agent',
      { registerTool: vi.fn(), server: { getClientCapabilities: () => ({}) } } as never,
    );
    const { handler: createHandler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      { registerTool: vi.fn(), server: { getClientCapabilities: () => ({}) } } as never,
    );

    const args = { projectUuid: PROJECT, name: 'Analyst', enableDataAccess: true };
    const preview = parseAiAgentToolBody(
      await previewHandler(args, { mcpReq: { envelope: {} } }),
    ) as {
      data: { createPreviewToken: string };
    };
    expect(preview.data.createPreviewToken).toEqual(expect.any(String));

    const confirm = parseAiAgentToolBody(
      await confirmHandler(
        {
          projectUuid: PROJECT,
          name: 'Analyst',
          createPreviewToken: preview.data.createPreviewToken,
        },
        { mcpReq: { envelope: {} } },
      ),
    ) as { data: { createConfirmToken: string } };
    expect(confirm.data.createConfirmToken).toEqual(expect.any(String));

    const created = parseAiAgentToolBody(
      await createHandler(
        { ...args, createConfirmToken: confirm.data.createConfirmToken },
        { mcpReq: { envelope: {} } },
      ),
    );
    expect(createAgent).toHaveBeenCalledTimes(1);
    expect(created.data).toEqual({ uuid: AGENT, name: 'Analyst' });
    expect(created.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'ELEVATED_DATA_ACCESS' })]),
    );
  });

  it('preview_create_agent lists spaces once when spaceAccess is set', async () => {
    const spaceUuid = '00000000-0000-4000-8000-000000000040';
    const listSpacesInProject = vi.fn().mockResolvedValue([{ uuid: spaceUuid, name: 'Finance' }]);
    const { handler } = registeredAiAgentTool(
      registerPreviewCreateAgent,
      mockAiAgentsContext(
        { getExploreAccessSummary: vi.fn().mockResolvedValue([]) },
        { listSpacesInProject },
      ),
      'preview_create_agent',
      { registerTool: vi.fn(), server: { getClientCapabilities: () => ({}) } } as never,
    );

    const result = parseAiAgentToolBody(
      await handler(
        { projectUuid: PROJECT, name: 'Analyst', spaceAccess: [spaceUuid] },
        { mcpReq: { envelope: {} } },
      ),
    ) as { warnings: Array<{ code: string }> };

    expect(listSpacesInProject).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual([]);
  });

  it('returns InputRequiredResult on first call when form elicitation is present', async () => {
    const createAgent = vi.fn();
    const getExploreAccessSummary = vi.fn().mockResolvedValue([]);
    const captureServer = {
      registerTool: vi.fn(),
      server: { getClientCapabilities: () => ({ elicitation: { form: {} } }) },
    };
    const { handler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      captureServer as never,
    );

    const result = await handler(
      {
        projectUuid: PROJECT,
        name: 'Analyst',
        enableDataAccess: true,
        tags: ['nope'],
      },
      formCapsServerContext(),
    );

    expect(isInputRequiredResult(result)).toBe(true);
    if (!isInputRequiredResult(result)) {
      return;
    }
    expect(result.requestState).toEqual(expect.any(String));
    expect(result.inputRequests?.[CONFIRM_CREATE_AGENT_INPUT_KEY]).toBeDefined();
    expect(createAgent).not.toHaveBeenCalled();
    expect(getExploreAccessSummary).toHaveBeenCalled();
  });

  it('creates after accept and warns when tags match no explores', async () => {
    resetCreateAgentRequestStateCodecForTests();
    process.env.NODE_ENV = 'test';

    const createAgent = vi.fn().mockResolvedValue({ uuid: AGENT, name: 'Analyst' });
    const getExploreAccessSummary = vi.fn().mockResolvedValue([]);
    const captureServer = {
      registerTool: vi.fn(),
      server: { getClientCapabilities: () => ({ elicitation: { form: {} } }) },
    };
    const { handler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      captureServer as never,
    );

    const args = {
      projectUuid: PROJECT,
      name: 'Analyst',
      enableDataAccess: true,
      tags: ['nope'],
    };

    const first = await handler(args, formCapsServerContext());
    expect(isInputRequiredResult(first)).toBe(true);
    if (!isInputRequiredResult(first)) {
      return;
    }

    const codec = getCreateAgentRequestStateCodec();
    const serverContext = formCapsServerContext({
      requestState: first.requestState as string,
      inputResponses: {
        [CONFIRM_CREATE_AGENT_INPUT_KEY]: {
          kind: 'elicit',
          action: 'accept',
          content: { decision: 'confirm_create' },
        },
      },
    });
    // Ensure codec can verify the minted token in the same test process
    await codec.verify(String(first.requestState), serverContext);

    const second = await (handler as ToolHandler)(args, serverContext);
    expect(isInputRequiredResult(second)).toBe(false);
    expect(createAgent).toHaveBeenCalledTimes(1);
    const body = parseAiAgentToolBody(second as { content: Array<{ type: string; text: string }> });
    expect(body.data).toEqual({ uuid: AGENT, name: 'Analyst' });
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'TAGS_MATCH_NO_EXPLORES' }),
        expect.objectContaining({ code: 'ELEVATED_DATA_ACCESS' }),
      ]),
    );
  });

  it('does not create when decision is do_not_create', async () => {
    resetCreateAgentRequestStateCodecForTests();
    process.env.NODE_ENV = 'test';

    const createAgent = vi.fn();
    const getExploreAccessSummary = vi.fn().mockResolvedValue([{ exploreName: 'orders' }]);
    const captureServer = {
      registerTool: vi.fn(),
      server: { getClientCapabilities: () => ({ elicitation: { form: {} } }) },
    };
    const { handler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      captureServer as never,
    );

    const args = { projectUuid: PROJECT, name: 'Analyst', enableDataAccess: true };
    const first = await handler(args, formCapsServerContext());
    expect(isInputRequiredResult(first)).toBe(true);
    if (!isInputRequiredResult(first)) {
      return;
    }

    const second = await handler(
      args,
      formCapsServerContext({
        requestState: first.requestState as string,
        inputResponses: {
          [CONFIRM_CREATE_AGENT_INPUT_KEY]: {
            kind: 'elicit',
            action: 'accept',
            content: { decision: 'do_not_create' },
          },
        },
      }),
    );
    expect(createAgent).not.toHaveBeenCalled();
    const body = parseAiAgentToolBody(second);
    expect(body.status).toBe('declined');
    expect(body.created).toBe(false);
  });

  it('blocks when payload changes after confirmation was minted', async () => {
    resetCreateAgentRequestStateCodecForTests();
    process.env.NODE_ENV = 'test';

    const createAgent = vi.fn();
    const getExploreAccessSummary = vi.fn().mockResolvedValue([]);
    const captureServer = {
      registerTool: vi.fn(),
      server: { getClientCapabilities: () => ({ elicitation: { form: {} } }) },
    };
    const { handler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      captureServer as never,
    );

    const first = await handler(
      { projectUuid: PROJECT, name: 'Analyst', enableDataAccess: true },
      formCapsServerContext(),
    );
    expect(isInputRequiredResult(first)).toBe(true);
    if (!isInputRequiredResult(first)) {
      return;
    }

    const second = await handler(
      { projectUuid: PROJECT, name: 'Analyst RENAMED', enableDataAccess: true },
      formCapsServerContext({
        requestState: first.requestState as string,
        inputResponses: {
          [CONFIRM_CREATE_AGENT_INPUT_KEY]: {
            kind: 'elicit',
            action: 'accept',
            content: { decision: 'confirm_create' },
          },
        },
      }),
    );
    expect(createAgent).not.toHaveBeenCalled();
    const body = parseAiAgentToolBody(second);
    expect(body.code).toBe('CONFIRMATION_INVALID');
  });

  it('decline action does not create', async () => {
    resetCreateAgentRequestStateCodecForTests();
    process.env.NODE_ENV = 'test';

    const createAgent = vi.fn();
    const getExploreAccessSummary = vi.fn().mockResolvedValue([]);
    const captureServer = {
      registerTool: vi.fn(),
      server: { getClientCapabilities: () => ({ elicitation: { form: {} } }) },
    };
    const { handler } = registeredAiAgentTool(
      registerCreateProjectAgent,
      mockAiAgentsContext({ createAgent, getExploreAccessSummary }),
      'create_project_agent',
      captureServer as never,
    );

    const token = await mintCreateAgentRequestState(
      {
        operationId: 'create_project_agent',
        projectUuid: PROJECT,
        payloadDigest: digestCreateAgentPayload({ name: 'Analyst', enableDataAccess: true }),
        subject: 'anonymous',
      },
      formCapsServerContext(),
    );

    const result = await handler(
      { projectUuid: PROJECT, name: 'Analyst', enableDataAccess: true },
      formCapsServerContext({
        requestState: token,
        inputResponses: {
          [CONFIRM_CREATE_AGENT_INPUT_KEY]: { kind: 'elicit', action: 'decline' },
        },
      }),
    );
    expect(createAgent).not.toHaveBeenCalled();
    expect(parseAiAgentToolBody(result).status).toBe('declined');
  });
});

describe('update_project_agent tag warnings', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when patch tags match no explores', async () => {
    const updateAgent = vi.fn().mockResolvedValue({ uuid: AGENT, tags: ['x'] });
    const getExploreAccessSummary = vi.fn().mockResolvedValue([]);
    const { handler } = registeredAiAgentTool(
      registerUpdateProjectAgent,
      mockAiAgentsContext({ updateAgent, getExploreAccessSummary }),
      'update_project_agent',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      tags: ['x'],
    });
    const body = parseAiAgentToolBody(result);
    expect(updateAgent).toHaveBeenCalled();
    expect(body.warnings).toEqual([expect.objectContaining({ code: 'TAGS_MATCH_NO_EXPLORES' })]);
  });

  it('skips explore summary when tags are omitted from the patch', async () => {
    const updateAgent = vi.fn().mockResolvedValue({ uuid: AGENT, instruction: 'Updated' });
    const getExploreAccessSummary = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerUpdateProjectAgent,
      mockAiAgentsContext({ updateAgent, getExploreAccessSummary }),
      'update_project_agent',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      instruction: 'Updated',
    });
    expect(getExploreAccessSummary).not.toHaveBeenCalled();
    expect(parseAiAgentToolBody(result).warnings).toEqual([]);
  });

  it('warns when patch elevates data access', async () => {
    const updateAgent = vi.fn().mockResolvedValue({ uuid: AGENT, enableDataAccess: true });
    const getExploreAccessSummary = vi.fn();
    const { handler } = registeredAiAgentTool(
      registerUpdateProjectAgent,
      mockAiAgentsContext({ updateAgent, getExploreAccessSummary }),
      'update_project_agent',
    );
    const result = await handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      enableDataAccess: true,
    });
    const body = parseAiAgentToolBody(result);
    expect(body.warnings).toEqual([expect.objectContaining({ code: 'ELEVATED_DATA_ACCESS' })]);
  });
});
