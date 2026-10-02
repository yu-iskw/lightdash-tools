/**
 * AI agent knowledge document tools (ai-agent-ops profile).
 */

import {
  AGENT_DOCUMENT_DEFAULT_MIME,
  AGENT_DOCUMENT_MAX_BYTES,
  agentDocumentContentByteLength,
  defaultAgentDocumentFilename,
  isAgentDocumentContentWithinLimit,
  isAllowedAgentDocumentMimeType,
  WRITE_DESTRUCTIVE,
  WRITE_NONDESTRUCTIVE,
} from '@lightdash-tools/common';
import { z } from 'zod';

import { registerToolSafe, wrapTool, READ_ONLY_DEFAULT } from '../shared.js';
import { defineTool } from '../types.js';

import {
  agentUuidField,
  documentUuidField,
  includeDocumentContentField,
  optionalProjectUuidField,
  redactDocumentContent,
  withAiAgentProjectScope,
  type AiAgentScopeArgs,
} from './helpers.js';
import { knowledgeDocumentWarnings } from './knowledge-warnings.js';

import type { McpContextProvider } from '../../server/request-context.js';
import type {
  AgentDocumentMimeType,
  AiAgentDocument,
  AiAgentDocumentContent,
  CreateAgentDocumentBody,
} from '@lightdash-tools/common';
import type { McpServer } from '@modelcontextprotocol/server';

const documentNameField = (): z.ZodString =>
  z.string().trim().min(1).describe('Knowledge document display name');

const documentContentField = (): z.ZodString =>
  z
    .string()
    .describe(
      'Inline document body (Markdown or plain text). Host reads local files and passes the string — no server filePath.',
    );

const mimeTypeField = (): z.ZodOptional<z.ZodString> =>
  z.string().optional().describe('MIME type: text/markdown (default) or text/plain');

const originalFilenameField = (): z.ZodOptional<z.ZodString> =>
  z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Original filename hint (default derived from name)');

const alwaysIncludeInContextField = (): z.ZodOptional<z.ZodBoolean> =>
  z
    .boolean()
    .optional()
    .describe(
      'When true, embed full document in every agent prompt (token cost). Default is on-demand retrieval.',
    );

function assertAgentDocumentContentWithinLimit(content: string): void {
  if (!isAgentDocumentContentWithinLimit(content)) {
    const bytes = agentDocumentContentByteLength(content);
    throw new Error(
      `Knowledge document content exceeds ${AGENT_DOCUMENT_MAX_BYTES} bytes (${bytes} bytes). Split into focused documents per Lightdash guidance.`,
    );
  }
}

function resolveDocumentMimeType(mimeType: string | undefined): AgentDocumentMimeType {
  const resolved = mimeType ?? AGENT_DOCUMENT_DEFAULT_MIME;
  if (!isAllowedAgentDocumentMimeType(resolved)) {
    throw new Error(`Unsupported mimeType "${resolved}". Allowed: text/markdown, text/plain.`);
  }
  return resolved;
}

function buildCreateDocumentBody(args: {
  name: string;
  content: string;
  mimeType?: string;
  originalFilename?: string;
}): CreateAgentDocumentBody {
  assertAgentDocumentContentWithinLimit(args.content);
  const mimeType = resolveDocumentMimeType(args.mimeType);
  return {
    name: args.name.trim(),
    content: args.content,
    mimeType,
    originalFilename:
      args.originalFilename?.trim() ?? defaultAgentDocumentFilename(args.name, mimeType),
  };
}

async function maybeApplyAlwaysIncludeInContext(
  client: {
    updateDocumentSettings: (
      projectUuid: string,
      agentUuid: string,
      documentUuid: string,
      body: { alwaysIncludeInContext: boolean },
    ) => Promise<void>;
  },
  projectUuid: string,
  agentUuid: string,
  document: AiAgentDocument,
  alwaysIncludeInContext: boolean | undefined,
): Promise<AiAgentDocument> {
  if (alwaysIncludeInContext !== true) {
    return document;
  }
  await client.updateDocumentSettings(projectUuid, agentUuid, document.uuid, {
    alwaysIncludeInContext: true,
  });
  return { ...document, alwaysIncludeInContext: true };
}

type AgentDocumentUpdateClient = {
  getDocumentContent: (
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
  ) => Promise<AiAgentDocumentContent>;
  updateDocumentContent: (
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
    body: { name: string; content: string },
  ) => Promise<AiAgentDocument | AiAgentDocumentContent>;
  updateDocumentSettings: (
    projectUuid: string,
    agentUuid: string,
    documentUuid: string,
    body: { alwaysIncludeInContext: boolean },
  ) => Promise<void>;
};

type AgentDocumentUpdateScope = {
  client: AgentDocumentUpdateClient;
  projectUuid: string;
  agentUuid: string;
  documentUuid: string;
};

async function updateAgentDocumentContentFields(
  scope: AgentDocumentUpdateScope,
  name: string | undefined,
  content: string | undefined,
): Promise<AiAgentDocument | AiAgentDocumentContent> {
  const { client, projectUuid, agentUuid, documentUuid } = scope;
  let nextName: string;
  let nextContent: string;
  if (name !== undefined && content !== undefined) {
    nextName = name.trim();
    nextContent = content;
  } else {
    const current = await client.getDocumentContent(projectUuid, agentUuid, documentUuid);
    nextName = name?.trim() ?? current.name;
    nextContent = content ?? current.content;
  }
  assertAgentDocumentContentWithinLimit(nextContent);
  return client.updateDocumentContent(projectUuid, agentUuid, documentUuid, {
    name: nextName,
    content: nextContent,
  });
}

async function applyAlwaysIncludeInContextUpdate(
  scope: AgentDocumentUpdateScope,
  document: AiAgentDocument | AiAgentDocumentContent | undefined,
  alwaysIncludeInContext: boolean,
): Promise<AiAgentDocument | AiAgentDocumentContent> {
  const { client, projectUuid, agentUuid, documentUuid } = scope;
  await client.updateDocumentSettings(projectUuid, agentUuid, documentUuid, {
    alwaysIncludeInContext,
  });
  const base = document ?? (await client.getDocumentContent(projectUuid, agentUuid, documentUuid));
  return { ...base, alwaysIncludeInContext };
}

export function registerListAgentDocuments(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'list_agent_documents',
    {
      title: 'List agent documents',
      description:
        'List knowledge document summaries for an agent (org-level plus agent-scoped). Summaries only — no full content.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({ projectUuid, agentUuid }: AiAgentScopeArgs) =>
          withAiAgentProjectScope(projectUuid, async (scope) => ({
            data: await c.v1.aiAgents.listDocuments(scope.projectUuid, agentUuid),
          })),
    ),
  );
}

export function registerGetAgentDocument(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'get_agent_document',
    {
      title: 'Get agent document',
      description:
        'Read a knowledge document. Content is redacted unless includeDocumentContent=true.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        documentUuid: documentUuidField(),
        includeDocumentContent: includeDocumentContentField(),
      },
      annotations: READ_ONLY_DEFAULT,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          documentUuid,
          includeDocumentContent,
        }: AiAgentScopeArgs & { documentUuid: string; includeDocumentContent?: boolean }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const document = await c.v1.aiAgents.getDocumentContent(
              scope.projectUuid,
              agentUuid,
              documentUuid,
            );
            return redactDocumentContent(document, includeDocumentContent === true);
          }),
    ),
  );
}

export function registerCreateAgentDocument(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'create_agent_document',
    {
      title: 'Create agent document',
      description:
        'Upload inline knowledge (glossary, SOP, metric definitions) scoped to this agent. JSON body — not multipart. Max 20KB.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        name: documentNameField(),
        content: documentContentField(),
        mimeType: mimeTypeField(),
        originalFilename: originalFilenameField(),
        alwaysIncludeInContext: alwaysIncludeInContextField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          name,
          content,
          mimeType,
          originalFilename,
          alwaysIncludeInContext,
        }: AiAgentScopeArgs & {
          name: string;
          content: string;
          mimeType?: string;
          originalFilename?: string;
          alwaysIncludeInContext?: boolean;
        }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            const body = buildCreateDocumentBody({
              name,
              content,
              mimeType,
              originalFilename,
            });
            let document = await c.v1.aiAgents.createDocument(scope.projectUuid, agentUuid, body);
            document = await maybeApplyAlwaysIncludeInContext(
              c.v1.aiAgents,
              scope.projectUuid,
              agentUuid,
              document,
              alwaysIncludeInContext,
            );
            return {
              data: document,
              warnings: knowledgeDocumentWarnings({ alwaysIncludeInContext }),
            };
          }),
    ),
  );
}

export function registerUpdateAgentDocument(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'update_agent_document',
    {
      title: 'Update agent document',
      description:
        'Update knowledge document content and/or alwaysIncludeInContext. Provide at least one field. Content max 20KB.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        documentUuid: documentUuidField(),
        name: documentNameField().optional(),
        content: documentContentField().optional(),
        alwaysIncludeInContext: alwaysIncludeInContextField(),
      },
      annotations: WRITE_NONDESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          documentUuid,
          name,
          content,
          alwaysIncludeInContext,
        }: AiAgentScopeArgs & {
          documentUuid: string;
          name?: string;
          content?: string;
          alwaysIncludeInContext?: boolean;
        }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            if (
              name === undefined &&
              content === undefined &&
              alwaysIncludeInContext === undefined
            ) {
              throw new Error(
                'Provide at least one of name, content, or alwaysIncludeInContext to update.',
              );
            }

            let document: AiAgentDocument | AiAgentDocumentContent | undefined;
            const updateScope = {
              client: c.v1.aiAgents,
              projectUuid: scope.projectUuid,
              agentUuid,
              documentUuid,
            };

            if (name !== undefined || content !== undefined) {
              document = await updateAgentDocumentContentFields(updateScope, name, content);
            }

            if (alwaysIncludeInContext !== undefined) {
              document = await applyAlwaysIncludeInContextUpdate(
                updateScope,
                document,
                alwaysIncludeInContext,
              );
            }

            if (document === undefined) {
              throw new Error('Document update did not produce a result.');
            }

            return {
              data: document,
              warnings: knowledgeDocumentWarnings({ alwaysIncludeInContext }),
            };
          }),
    ),
  );
}

export function registerDeleteAgentDocument(
  server: McpServer,
  contextProvider: McpContextProvider,
): void {
  registerToolSafe(
    server,
    'delete_agent_document',
    {
      title: 'Delete agent document',
      description: 'Delete a knowledge document from this agent.',
      inputSchema: {
        projectUuid: optionalProjectUuidField(),
        agentUuid: agentUuidField(),
        documentUuid: documentUuidField(),
      },
      annotations: WRITE_DESTRUCTIVE,
    },
    wrapTool(
      contextProvider,
      (c) =>
        async ({
          projectUuid,
          agentUuid,
          documentUuid,
        }: AiAgentScopeArgs & { documentUuid: string }) =>
          withAiAgentProjectScope(projectUuid, async (scope) => {
            await c.v1.aiAgents.deleteDocument(scope.projectUuid, agentUuid, documentUuid);
            return { data: { deleted: true, documentUuid } };
          }),
    ),
  );
}

export const listAgentDocumentsTool = defineTool(
  'list_agent_documents',
  registerListAgentDocuments,
);
export const getAgentDocumentTool = defineTool('get_agent_document', registerGetAgentDocument);
export const createAgentDocumentTool = defineTool(
  'create_agent_document',
  registerCreateAgentDocument,
);
export const updateAgentDocumentTool = defineTool(
  'update_agent_document',
  registerUpdateAgentDocument,
);
export const deleteAgentDocumentTool = defineTool(
  'delete_agent_document',
  registerDeleteAgentDocument,
);
