import { describe, expect, it } from 'vitest';

import {
  AGENT_DOCUMENT_MAX_BYTES,
  agentDocumentContentByteLength,
  defaultAgentDocumentFilename,
  isAgentDocumentContentWithinLimit,
  isAllowedAgentDocumentMimeType,
} from './document-limits.js';

describe('document-limits', () => {
  it('measures UTF-8 byte length', () => {
    expect(agentDocumentContentByteLength('hello')).toBe(5);
    expect(agentDocumentContentByteLength('€')).toBe(3);
  });

  it('enforces the 20KB ceiling', () => {
    expect(isAgentDocumentContentWithinLimit('x'.repeat(AGENT_DOCUMENT_MAX_BYTES))).toBe(true);
    expect(isAgentDocumentContentWithinLimit('x'.repeat(AGENT_DOCUMENT_MAX_BYTES + 1))).toBe(false);
  });

  it('allows markdown and plain text mime types only', () => {
    expect(isAllowedAgentDocumentMimeType('text/markdown')).toBe(true);
    expect(isAllowedAgentDocumentMimeType('text/plain')).toBe(true);
    expect(isAllowedAgentDocumentMimeType('application/pdf')).toBe(false);
  });

  it('derives default filenames from name and mime type', () => {
    expect(defaultAgentDocumentFilename('Glossary', 'text/markdown')).toBe('Glossary.md');
    expect(defaultAgentDocumentFilename('notes.txt', 'text/plain')).toBe('notes.txt');
  });
});
