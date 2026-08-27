/**
 * Lightdash AI agent knowledge document limits (product docs: 20KB per document).
 */

export const AGENT_DOCUMENT_MAX_BYTES = 20_480;

export const AGENT_DOCUMENT_DEFAULT_MIME = 'text/markdown' as const;

export const AGENT_DOCUMENT_ALLOWED_MIME_TYPES = ['text/markdown', 'text/plain'] as const;

export type AgentDocumentMimeType = (typeof AGENT_DOCUMENT_ALLOWED_MIME_TYPES)[number];

export function agentDocumentContentByteLength(content: string): number {
  return Buffer.byteLength(content, 'utf8');
}

export function isAgentDocumentContentWithinLimit(content: string): boolean {
  return agentDocumentContentByteLength(content) <= AGENT_DOCUMENT_MAX_BYTES;
}

export function isAllowedAgentDocumentMimeType(
  mimeType: string,
): mimeType is AgentDocumentMimeType {
  return (AGENT_DOCUMENT_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Derive a filename hint when the host omits originalFilename. */
export function defaultAgentDocumentFilename(
  name: string,
  mimeType: AgentDocumentMimeType,
): string {
  const trimmed = name.trim();
  const base = trimmed.length > 0 ? trimmed : 'document';
  if (mimeType === 'text/plain') {
    return base.endsWith('.txt') ? base : `${base}.txt`;
  }
  return base.endsWith('.md') ? base : `${base}.md`;
}
