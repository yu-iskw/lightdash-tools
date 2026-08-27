import { describe, expect, it, vi } from 'vitest';

import {
  registerCreateAgentDocument,
  registerGetAgentDocument,
  registerUpdateAgentDocument,
} from './documents.js';
import { redactDocumentContent } from './helpers.js';
import {
  mockAiAgentsContext,
  parseAiAgentToolBody,
  registeredAiAgentTool,
} from './test-support.js';

const PROJECT = '11111111-1111-1111-1111-111111111111';
const AGENT = '22222222-2222-2222-2222-222222222222';
const DOCUMENT = '33333333-3333-3333-3333-333333333333';

describe('ai-agents document helpers', () => {
  it('redacts document content by default', () => {
    const { data, warnings } = redactDocumentContent(
      { uuid: DOCUMENT, name: 'Glossary', content: 'secret terms' },
      false,
    );
    expect((data as { content: string }).content).toBe('[REDACTED]');
    expect(warnings).toHaveLength(1);
  });

  it('reveals document content when includeDocumentContent is true', () => {
    const { data, warnings } = redactDocumentContent(
      { uuid: DOCUMENT, name: 'Glossary', content: 'secret terms' },
      true,
    );
    expect((data as { content: string }).content).toBe('secret terms');
    expect(warnings).toHaveLength(0);
  });
});

describe('create_agent_document', () => {
  it('creates a document and patches alwaysIncludeInContext when requested', async () => {
    const createDocument = vi.fn().mockResolvedValue({
      uuid: DOCUMENT,
      name: 'Glossary',
      alwaysIncludeInContext: false,
    });
    const updateDocumentSettings = vi.fn().mockResolvedValue(undefined);
    const ctx = mockAiAgentsContext({ createDocument, updateDocumentSettings });
    const tool = registeredAiAgentTool(registerCreateAgentDocument, ctx, 'create_agent_document');

    const result = await tool.handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      name: 'Glossary',
      content: '# Terms',
      alwaysIncludeInContext: true,
    });
    const body = parseAiAgentToolBody(result);

    expect(createDocument).toHaveBeenCalledWith(PROJECT, AGENT, {
      name: 'Glossary',
      content: '# Terms',
      mimeType: 'text/markdown',
      originalFilename: 'Glossary.md',
    });
    expect(updateDocumentSettings).toHaveBeenCalledWith(PROJECT, AGENT, DOCUMENT, {
      alwaysIncludeInContext: true,
    });
    expect(body.data).toMatchObject({ uuid: DOCUMENT, alwaysIncludeInContext: true });
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'KNOWLEDGE_VISIBLE_TO_AGENT_USERS' }),
        expect.objectContaining({ code: 'DOCUMENT_ALWAYS_IN_CONTEXT' }),
      ]),
    );
  });

  it('rejects content over 20KB before upstream create', async () => {
    const createDocument = vi.fn();
    const ctx = mockAiAgentsContext({ createDocument });
    const tool = registeredAiAgentTool(registerCreateAgentDocument, ctx, 'create_agent_document');

    const result = await tool.handler({
      projectUuid: PROJECT,
      agentUuid: AGENT,
      name: 'Huge',
      content: 'x'.repeat(20_481),
    });

    expect(result.isError).toBe(true);
    expect(createDocument).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain('20480');
  });
});

describe('get_agent_document', () => {
  it('redacts content unless includeDocumentContent is true', async () => {
    const getDocumentContent = vi.fn().mockResolvedValue({
      uuid: DOCUMENT,
      name: 'Glossary',
      mimeType: 'text/markdown',
      content: 'secret',
    });
    const ctx = mockAiAgentsContext({ getDocumentContent });
    const tool = registeredAiAgentTool(registerGetAgentDocument, ctx, 'get_agent_document');

    const redacted = parseAiAgentToolBody(
      await tool.handler({ projectUuid: PROJECT, agentUuid: AGENT, documentUuid: DOCUMENT }),
    );
    expect((redacted.data as { content: string }).content).toBe('[REDACTED]');

    const revealed = parseAiAgentToolBody(
      await tool.handler({
        projectUuid: PROJECT,
        agentUuid: AGENT,
        documentUuid: DOCUMENT,
        includeDocumentContent: true,
      }),
    );
    expect((revealed.data as { content: string }).content).toBe('secret');
  });
});

describe('update_agent_document', () => {
  it('merges partial content updates with the current document', async () => {
    const getDocumentContent = vi
      .fn()
      .mockResolvedValueOnce({
        uuid: DOCUMENT,
        name: 'Glossary',
        mimeType: 'text/markdown',
        content: 'old body',
      })
      .mockResolvedValueOnce({
        uuid: DOCUMENT,
        name: 'Glossary',
        mimeType: 'text/markdown',
        content: 'new body',
      });
    const updateDocumentContent = vi.fn().mockResolvedValue({
      uuid: DOCUMENT,
      name: 'Glossary',
      content: 'new body',
    });
    const ctx = mockAiAgentsContext({ getDocumentContent, updateDocumentContent });
    const tool = registeredAiAgentTool(registerUpdateAgentDocument, ctx, 'update_agent_document');

    const body = parseAiAgentToolBody(
      await tool.handler({
        projectUuid: PROJECT,
        agentUuid: AGENT,
        documentUuid: DOCUMENT,
        content: 'new body',
      }),
    );

    expect(updateDocumentContent).toHaveBeenCalledWith(PROJECT, AGENT, DOCUMENT, {
      name: 'Glossary',
      content: 'new body',
    });
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'KNOWLEDGE_VISIBLE_TO_AGENT_USERS' }),
      ]),
    );
  });
});
