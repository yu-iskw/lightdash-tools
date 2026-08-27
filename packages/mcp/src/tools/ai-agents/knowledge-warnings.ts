/**
 * Soft warnings when curating agent knowledge documents.
 */

export type KnowledgeDocumentWarningCode =
  'DOCUMENT_ALWAYS_IN_CONTEXT' | 'KNOWLEDGE_VISIBLE_TO_AGENT_USERS';

export type KnowledgeDocumentWarning = {
  code: KnowledgeDocumentWarningCode;
  message: string;
};

export function knowledgeDocumentWarnings(options: {
  alwaysIncludeInContext?: boolean;
}): KnowledgeDocumentWarning[] {
  const warnings: KnowledgeDocumentWarning[] = [
    {
      code: 'KNOWLEDGE_VISIBLE_TO_AGENT_USERS',
      message:
        'Knowledge documents are visible to everyone who can use this agent. Do not upload secrets, customer PII, or material the agent audience should not see.',
    },
  ];

  if (options.alwaysIncludeInContext === true) {
    warnings.push({
      code: 'DOCUMENT_ALWAYS_IN_CONTEXT',
      message:
        'alwaysIncludeInContext embeds the full document in every agent prompt, increasing token use and latency. Prefer on-demand retrieval unless the context must apply to every turn.',
    });
  }

  return warnings;
}
