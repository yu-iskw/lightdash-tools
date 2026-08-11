/**
 * Progressive-disclosure prompt context composer (RFC: token-efficient MCP prompts).
 */

import {
  formatInvariantCapsule,
  resolveInvariants,
  type PromptInvariant,
} from './prompt-invariants.js';

import type { EmbeddedPlaybook } from './playbook-resources.js';
import type { PromptContextPolicy } from '../../config/prompt-context-policy.js';

export type PromptTopicMeta = {
  description: string;
  useWhen?: string;
};

export type PromptContextSpec<TopicId extends string> = {
  task: string;
  invariantIds: readonly string[];
  /** Embedded under compatible + embedded; listed in compact manifest. */
  requiredTopics?: readonly TopicId[];
  conditionalTopics?: readonly { topic: TopicId; when: string }[];
  recoveryTopics?: readonly { topic: TopicId; when: string }[];
};

type PromptTextContent = { type: 'text'; text: string };
type PromptResourceContent = {
  type: 'resource';
  resource: {
    uri: string;
    mimeType: string;
    text: string;
  };
};

export type PromptUserMessage = {
  role: 'user';
  content: PromptResourceContent | PromptTextContent;
};

function embedResource(playbook: EmbeddedPlaybook): PromptResourceContent {
  return {
    type: 'resource',
    resource: {
      uri: playbook.uri,
      mimeType: playbook.mimeType ?? 'text/markdown',
      text: playbook.getMarkdown(),
    },
  };
}

function uniqueTopicIds<TopicId extends string>(ids: readonly TopicId[]): TopicId[] {
  const seen = new Set<TopicId>();
  const out: TopicId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function formatManifestSection<TopicId extends string>(
  title: string,
  entries: readonly { topic: TopicId; when: string; uri: string }[],
): string {
  if (entries.length === 0) {
    return '';
  }
  const sorted = [...entries].sort((a, b) => String(a.topic).localeCompare(String(b.topic)));
  const lines = sorted.map((e) => `- ${e.uri} — ${e.when}`);
  return [title, ...lines].join('\n');
}

function buildManifestText<TopicId extends string>(options: {
  requiredTopics: readonly TopicId[];
  conditionalTopics: readonly { topic: TopicId; when: string }[];
  recoveryTopics: readonly { topic: TopicId; when: string }[];
  topics: Readonly<Record<TopicId, EmbeddedPlaybook>>;
  topicMeta: Readonly<Record<TopicId, PromptTopicMeta>>;
}): string {
  const { requiredTopics, conditionalTopics, recoveryTopics, topics, topicMeta } = options;

  const requiredEntries = requiredTopics.map((topic) => {
    // eslint-disable-next-line security/detect-object-injection -- topic ids from prompt constants
    const meta = topicMeta[topic];
    // eslint-disable-next-line security/detect-object-injection -- topic ids from prompt constants
    const playbook = topics[topic];
    return {
      topic,
      when: meta?.useWhen ?? meta?.description ?? String(topic),
      uri: playbook.uri,
    };
  });

  const conditionalEntries = conditionalTopics.map((entry) => {
    const playbook = topics[entry.topic];
    return { topic: entry.topic, when: entry.when, uri: playbook.uri };
  });

  const recoveryEntries = recoveryTopics.map((entry) => {
    const playbook = topics[entry.topic];
    return { topic: entry.topic, when: entry.when, uri: playbook.uri };
  });

  const parts = [
    formatManifestSection('Required detailed resources:', requiredEntries),
    formatManifestSection('Conditional detailed resources:', conditionalEntries),
    formatManifestSection('Recovery resources:', recoveryEntries),
  ].filter((p) => p.length > 0);

  if (parts.length === 0) {
    return '';
  }
  return ['Detailed resources:', ...parts].join('\n\n');
}

function requireTopic<TopicId extends string>(
  topics: Readonly<Record<TopicId, EmbeddedPlaybook>>,
  id: TopicId,
): EmbeddedPlaybook {
  // eslint-disable-next-line security/detect-object-injection -- topic ids from prompt constants
  const topic = topics[id];
  if (!topic) {
    throw new Error(`Unknown playbook topic '${String(id)}'`);
  }
  return topic;
}

function assertKnownTopics<TopicId extends string>(
  topics: Readonly<Record<TopicId, EmbeddedPlaybook>>,
  requiredTopics: readonly TopicId[],
  conditionalTopics: readonly { topic: TopicId; when: string }[],
  recoveryTopics: readonly { topic: TopicId; when: string }[],
): void {
  for (const id of requiredTopics) {
    requireTopic(topics, id);
  }
  for (const entry of conditionalTopics) {
    requireTopic(topics, entry.topic);
  }
  for (const entry of recoveryTopics) {
    requireTopic(topics, entry.topic);
  }
}

function buildComposerText(options: {
  task: string;
  invariantText: string;
  manifestText: string;
  includeManifest: boolean;
}): string {
  const parts = [options.task.trim()];
  if (options.invariantText) {
    parts.push(options.invariantText);
  }
  if (options.includeManifest && options.manifestText) {
    parts.push(options.manifestText);
  }
  return parts.filter((p) => p.length > 0).join('\n\n');
}

function appendTopicResources<TopicId extends string>(
  messages: PromptUserMessage[],
  topics: Readonly<Record<TopicId, EmbeddedPlaybook>>,
  requiredTopics: readonly TopicId[],
): void {
  for (const id of requiredTopics) {
    messages.push({
      role: 'user',
      content: embedResource(requireTopic(topics, id)),
    });
  }
}

/**
 * Build a prompts/get composer for a profile under a fixed context policy.
 */
export function createPromptContextComposer<TopicId extends string>(options: {
  policy: PromptContextPolicy;
  invariants: readonly PromptInvariant[];
  core: EmbeddedPlaybook;
  topics: Readonly<Record<TopicId, EmbeddedPlaybook>>;
  topicMeta: Readonly<Record<TopicId, PromptTopicMeta>>;
}): (spec: PromptContextSpec<TopicId>) => { messages: PromptUserMessage[] } {
  const { policy, invariants, core, topics, topicMeta } = options;

  return (spec: PromptContextSpec<TopicId>) => {
    const requiredTopics = uniqueTopicIds(spec.requiredTopics ?? []);
    const conditionalTopics = spec.conditionalTopics ?? [];
    const recoveryTopics = spec.recoveryTopics ?? [];
    assertKnownTopics(topics, requiredTopics, conditionalTopics, recoveryTopics);

    const selectedInvariants = resolveInvariants(invariants, spec.invariantIds);
    const text = buildComposerText({
      task: spec.task,
      invariantText: formatInvariantCapsule(selectedInvariants),
      manifestText: buildManifestText({
        requiredTopics,
        conditionalTopics,
        recoveryTopics,
        topics,
        topicMeta,
      }),
      includeManifest: policy !== 'embedded',
    });

    const messages: PromptUserMessage[] = [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ];

    switch (policy) {
      case 'compact':
        return { messages };
      case 'compatible':
        appendTopicResources(messages, topics, requiredTopics);
        return { messages };
      case 'embedded':
        // Legacy parity: core + required topics (caller lists former embed set as required)
        messages.push({
          role: 'user',
          content: embedResource(core),
        });
        appendTopicResources(messages, topics, requiredTopics);
        return { messages };
      default: {
        const _exhaustive: never = policy;
        return _exhaustive;
      }
    }
  };
}

/** Approx token estimate: ceil(chars / 4). */
export function approxTokensFromChars(chars: number): number {
  return Math.ceil(chars / 4);
}

export type PromptContextMetrics = {
  taskChars: number;
  invariantChars: number;
  manifestChars: number;
  embeddedResourceChars: number;
  totalChars: number;
  approxTotalTokens: number;
  embeddedResourceCount: number;
};

function measureTextSections(text: string): {
  taskChars: number;
  invariantChars: number;
  manifestChars: number;
} {
  const invIdx = text.indexOf('Critical invariants:');
  const manIdx = text.indexOf('Detailed resources:');
  const invariantChars =
    invIdx >= 0 ? Math.max(0, (manIdx >= 0 ? manIdx : text.length) - invIdx) : 0;
  const manifestChars = manIdx >= 0 ? text.length - manIdx : 0;
  return { taskChars: text.length, invariantChars, manifestChars };
}

function messageCharLength(message: PromptUserMessage): number {
  return message.content.type === 'text'
    ? message.content.text.length
    : message.content.resource.text.length;
}

/** Measure rendered prompt messages (provider-neutral). */
export function measurePromptMessages(
  messages: readonly PromptUserMessage[],
): PromptContextMetrics {
  let taskChars = 0;
  let invariantChars = 0;
  let manifestChars = 0;
  let embeddedResourceChars = 0;
  let embeddedResourceCount = 0;

  for (const message of messages) {
    if (message.content.type === 'text') {
      const measured = measureTextSections(message.content.text);
      taskChars += measured.taskChars;
      invariantChars += measured.invariantChars;
      manifestChars += measured.manifestChars;
      continue;
    }
    embeddedResourceCount += 1;
    embeddedResourceChars += message.content.resource.text.length;
  }

  const totalChars = messages.reduce((sum, message) => sum + messageCharLength(message), 0);

  return {
    taskChars,
    invariantChars,
    manifestChars,
    embeddedResourceChars,
    totalChars,
    approxTotalTokens: approxTokensFromChars(totalChars),
    embeddedResourceCount,
  };
}
