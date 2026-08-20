/**
 * Shared helpers for AI-agent MCP tools (ai-agent-ops and ai-agent-chat).
 */

import { z } from 'zod';

import { resolveProjectScope } from '../../governance/project-scope.js';
import { optionalProjectUuidField } from '../lib/schema-fields.js';
import { projectScopeErrorResult } from '../query/reader-tool-helpers.js';
import { jsonToolResult } from '../shared.js';

import type { ResolvedProjectScope } from '../../governance/project-scope.js';
import type { TextContent } from '../shared.js';

export { optionalProjectUuidField };

export const agentUuidField = (): z.ZodString => z.string().describe('AI agent UUID');

export const evalUuidField = (): z.ZodString => z.string().describe('Evaluation suite UUID');

export const runUuidField = (): z.ZodString => z.string().describe('Evaluation run UUID');

export const threadUuidField = (): z.ZodString => z.string().describe('Thread UUID');

/** Project + agent identity shared by inventory, thread, discovery, and eval tools. */
export type AiAgentScopeArgs = { projectUuid?: string; agentUuid: string };

export type AiAgentThreadScopeArgs = AiAgentScopeArgs & { threadUuid: string };

/** Conservative local prompt ceiling; not env-configurable in v1 (ADR-0029). */
export const THREAD_PROMPT_MAX_CHARS = 32_000;

export const threadPromptField = (): z.ZodString =>
  z
    .string()
    .trim()
    .min(1)
    .max(THREAD_PROMPT_MAX_CHARS)
    .describe('User prompt to store on the thread (not sent to /generate)');

const evaluationPromptSchema = z.union([
  z.object({
    prompt: z.string().min(1),
    expectedResponse: z.string().nullable().optional(),
  }),
  z.object({
    threadUuid: z.string().describe('Thread UUID'),
    promptUuid: z.string().describe('Prompt UUID'),
    expectedResponse: z.string().nullable().optional(),
  }),
]);

export const evaluationPromptsField = (): z.ZodArray<typeof evaluationPromptSchema> =>
  z.array(evaluationPromptSchema).describe('Evaluation prompts');

export const includeMessageTextField = (): z.ZodOptional<z.ZodBoolean> =>
  z.boolean().optional().describe('Return full message text when true (default false)');

export const includePromptTextField = (): z.ZodOptional<z.ZodBoolean> =>
  z
    .boolean()
    .optional()
    .describe('Return evaluation prompt / expected-response text when true (default false)');

export const CONVERSATION_REDACTED_WARNING = {
  code: 'REDACTED' as const,
  message:
    'Conversation text redacted (messages, firstMessage, title, context, reasoning, steers, tool I/O); pass includeMessageText=true to reveal',
};

export const PROMPT_REDACTED_WARNING = {
  code: 'REDACTED' as const,
  message: 'Evaluation prompt text redacted; pass includePromptText=true to reveal',
};

type RedactionWarning = { code: 'REDACTED'; message: string };

const MESSAGE_TEXT_KEYS = [
  'message',
  'prompt',
  'response',
  'text',
  'content',
  'humanFeedback',
  'errorMessage',
] as const;
const PROMPT_TEXT_KEYS = ['prompt', 'expectedResponse', 'errorMessage'] as const;
const REDACTED_TOOL_ARGS = { redacted: true } as const;
const REDACTED_CONTEXT = [{ redacted: true }] as const;

type ProjectScopedBody = Record<string, unknown> & { data: unknown };

/**
 * Resolve project scope, run the handler, and attach standard context.
 * Maps ProjectScopeError to a blocked tool result; other errors rethrow for wrapTool.
 */
export async function withAiAgentProjectScope(
  projectUuid: string | undefined,
  run: (scope: ResolvedProjectScope) => Promise<ProjectScopedBody>,
): Promise<TextContent> {
  try {
    const scope = resolveProjectScope({ projectUuid });
    const body = await run(scope);
    return jsonToolResult({
      ...body,
      context: {
        projectUuid: scope.projectUuid,
        projectPinned: scope.projectPinned,
        source: scope.source,
      },
    });
  } catch (err) {
    return projectScopeErrorResult(err);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function redactStringKeys(row: Record<string, unknown>, keys: readonly string[]): boolean {
  let changed = false;
  for (const key of keys) {
    if (!(key in row)) {
      continue;
    }
    // eslint-disable-next-line security/detect-object-injection -- key from fixed allowlists
    const value = row[key];
    if (typeof value === 'string' && value !== '[REDACTED]') {
      // eslint-disable-next-line security/detect-object-injection -- key from fixed allowlists
      row[key] = '[REDACTED]';
      changed = true;
    }
  }
  return changed;
}

function redactNestedTextRows(
  rows: unknown,
  textKeys: readonly string[],
): { rows: unknown; changed: boolean } {
  if (!Array.isArray(rows)) {
    return { rows, changed: false };
  }
  let changed = false;
  const next = rows.map((entry) => {
    const row = asRecord(entry);
    if (!row) {
      return entry;
    }
    const copy = { ...row };
    if (redactStringKeys(copy, textKeys)) {
      changed = true;
    }
    return copy;
  });
  return { rows: next, changed };
}

function mapRecordRows(
  rows: unknown,
  mutate: (copy: Record<string, unknown>) => boolean,
): { rows: unknown; changed: boolean } {
  if (!Array.isArray(rows)) {
    return { rows, changed: false };
  }
  let changed = false;
  const next = rows.map((entry) => {
    const row = asRecord(entry);
    if (!row) {
      return entry;
    }
    const copy = { ...row };
    if (mutate(copy)) {
      changed = true;
    }
    return copy;
  });
  return { rows: next, changed };
}

function redactTitle(container: Record<string, unknown>): boolean {
  return redactStringKeys(container, ['title']);
}

function redactFirstMessage(container: Record<string, unknown>): boolean {
  const first = asRecord(container.firstMessage);
  if (!first) {
    return false;
  }
  const copy = { ...first };
  const changed = redactStringKeys(copy, MESSAGE_TEXT_KEYS);
  if (changed) {
    container.firstMessage = copy;
  }
  return changed;
}

function redactMessageRow(message: unknown): { message: unknown; changed: boolean } {
  const row = asRecord(message);
  if (!row) {
    return { message, changed: false };
  }
  const copy = { ...row };
  let changed = redactStringKeys(copy, MESSAGE_TEXT_KEYS);

  if (Array.isArray(copy.context) && copy.context.length > 0) {
    const alreadyRedacted =
      copy.context.length === 1 && asRecord(copy.context[0])?.redacted === true;
    if (!alreadyRedacted) {
      copy.context = [...REDACTED_CONTEXT];
      changed = true;
    }
  }

  const reasoning = redactNestedTextRows(copy.reasoning, ['text']);
  if (reasoning.changed) {
    copy.reasoning = reasoning.rows;
    changed = true;
  }
  const steers = redactNestedTextRows(copy.steers, ['message']);
  if (steers.changed) {
    copy.steers = steers.rows;
    changed = true;
  }
  const toolCalls = mapRecordRows(copy.toolCalls, (entry) => {
    if (!('toolArgs' in entry) || entry.toolArgs === REDACTED_TOOL_ARGS) {
      return false;
    }
    entry.toolArgs = REDACTED_TOOL_ARGS;
    return true;
  });
  if (toolCalls.changed) {
    copy.toolCalls = toolCalls.rows;
    changed = true;
  }
  const toolResults = mapRecordRows(copy.toolResults, (entry) => {
    if (!('result' in entry) || entry.result === '[REDACTED]') {
      return false;
    }
    entry.result = '[REDACTED]';
    return true;
  });
  if (toolResults.changed) {
    copy.toolResults = toolResults.rows;
    changed = true;
  }

  return { message: copy, changed };
}

function redactMessageArray(container: Record<string, unknown>): boolean {
  const messages = container.messages;
  if (!Array.isArray(messages)) {
    return false;
  }
  let changed = false;
  const redactedMessages = messages.map((message) => {
    const next = redactMessageRow(message);
    if (next.changed) {
      changed = true;
    }
    return next.message;
  });
  if (changed) {
    container.messages = redactedMessages;
  }
  return changed;
}

/** Redact thread message bodies and firstMessage unless explicitly requested. */
export function redactThreadMessages(
  thread: unknown,
  includeMessageText: boolean,
): {
  data: unknown;
  warnings: RedactionWarning[];
} {
  if (includeMessageText) {
    return { data: thread, warnings: [] };
  }
  const base = asRecord(thread);
  if (!base) {
    return { data: thread, warnings: [] };
  }
  const data = { ...base };
  const changedTitle = redactTitle(data);
  const changedFirst = redactFirstMessage(data);
  const changedMessages = redactMessageArray(data);
  return {
    data,
    warnings:
      changedTitle || changedFirst || changedMessages ? [CONVERSATION_REDACTED_WARNING] : [],
  };
}

/** Redact firstMessage on each thread summary (list responses). */
export function redactThreadSummaries(
  threads: unknown,
  includeMessageText: boolean,
): {
  data: unknown;
  warnings: RedactionWarning[];
} {
  if (includeMessageText) {
    return { data: threads, warnings: [] };
  }
  if (!Array.isArray(threads)) {
    return redactThreadMessages(threads, false);
  }
  let changed = false;
  const data = threads.map((thread) => {
    const base = asRecord(thread);
    if (!base) {
      return thread;
    }
    const copy = { ...base };
    const changedTitle = redactTitle(copy);
    const changedFirst = redactFirstMessage(copy);
    if (changedTitle || changedFirst) {
      changed = true;
    }
    return copy;
  });
  return {
    data,
    warnings: changed ? [CONVERSATION_REDACTED_WARNING] : [],
  };
}

function redactPromptRows(rows: unknown[]): { rows: unknown[]; changed: boolean } {
  let changed = false;
  const next = rows.map((entry) => {
    const row = asRecord(entry);
    if (!row) {
      return entry;
    }
    const copy = { ...row };
    if (redactStringKeys(copy, PROMPT_TEXT_KEYS)) {
      changed = true;
    }
    const assessment = asRecord(copy.assessment);
    if (assessment) {
      const assessmentCopy = { ...assessment };
      if (redactStringKeys(assessmentCopy, ['reason'])) {
        copy.assessment = assessmentCopy;
        changed = true;
      }
    }
    return copy;
  });
  return { rows: next, changed };
}

function redactPromptTextCollection(
  payload: unknown,
  arrayKey: 'prompts' | 'results',
  includePromptText: boolean,
): {
  data: unknown;
  warnings: RedactionWarning[];
} {
  if (includePromptText) {
    return { data: payload, warnings: [] };
  }
  const base = asRecord(payload);
  if (!base) {
    return { data: payload, warnings: [] };
  }
  const data = { ...base };
  // eslint-disable-next-line security/detect-object-injection -- arrayKey is a fixed literal union
  const rows = data[arrayKey];
  if (!Array.isArray(rows)) {
    return { data, warnings: [] };
  }
  const next = redactPromptRows(rows);
  // eslint-disable-next-line security/detect-object-injection -- arrayKey is a fixed literal union
  data[arrayKey] = next.rows;
  return {
    data,
    warnings: next.changed ? [PROMPT_REDACTED_WARNING] : [],
  };
}

/** Redact evaluation suite prompt / expectedResponse fields. */
export function redactEvaluationPayload(
  evaluation: unknown,
  includePromptText: boolean,
): {
  data: unknown;
  warnings: RedactionWarning[];
} {
  return redactPromptTextCollection(evaluation, 'prompts', includePromptText);
}

/** Redact per-result prompt / expectedResponse / assessment reason on a run. */
export function redactEvalRunResults(
  run: unknown,
  includePromptText: boolean,
): {
  data: unknown;
  warnings: RedactionWarning[];
} {
  return redactPromptTextCollection(run, 'results', includePromptText);
}
