/**
 * Prompt context composer unit tests.
 */

import { describe, expect, it } from 'vitest';

import {
  createPromptContextComposer,
  measurePromptMessages,
} from './prompt-context.js';

import type { PromptInvariant } from './prompt-invariants.js';
import type { EmbeddedPlaybook } from './playbook-resources.js';

const INVARIANTS = [
  { id: 'no-mutation', severity: 'critical', short: 'Do not mutate resources.' },
  { id: 'project-scope', severity: 'critical', short: 'Stay inside the resolved project.' },
] as const satisfies readonly PromptInvariant[];

const core: EmbeddedPlaybook = {
  uri: 'lightdash://playbooks/test/core',
  getMarkdown: () => `# Core\n${'long core body '.repeat(80)}`,
};

const topics = {
  discover: {
    uri: 'lightdash://playbooks/test/discover',
    getMarkdown: () => `# Discover\n${'discover body '.repeat(40)}`,
  },
  recovery: {
    uri: 'lightdash://playbooks/test/recovery/preview-stale',
    getMarkdown: () => '# Recovery\nre-preview',
  },
} as const satisfies Record<string, EmbeddedPlaybook>;

const topicMeta = {
  discover: { description: 'Discovery guidance', useWhen: 'Weak search results' },
  recovery: { description: 'Preview stale recovery', useWhen: 'PREVIEW_STALE' },
};

describe('createPromptContextComposer', () => {
  it('compact returns text only with invariants and manifest', () => {
    const compose = createPromptContextComposer({
      policy: 'compact',
      invariants: INVARIANTS,
      core,
      topics,
      topicMeta,
    });
    const { messages } = compose({
      task: 'Find content for revenue',
      invariantIds: ['no-mutation', 'project-scope'],
      requiredTopics: ['discover'],
      recoveryTopics: [{ topic: 'recovery', when: 'After PREVIEW_STALE' }],
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]!.content.type).toBe('text');
    if (messages[0]!.content.type !== 'text') return;
    const text = messages[0]!.content.text;
    expect(text).toContain('Find content for revenue');
    expect(text).toContain('Critical invariants:');
    expect(text).toContain('Do not mutate resources.');
    expect(text).toContain('lightdash://playbooks/test/discover');
    expect(text).not.toContain('long core body');
  });

  it('compatible embeds required topics only', () => {
    const compose = createPromptContextComposer({
      policy: 'compatible',
      invariants: INVARIANTS,
      core,
      topics,
      topicMeta,
    });
    const { messages } = compose({
      task: 'Find content',
      invariantIds: ['no-mutation'],
      requiredTopics: ['discover'],
      conditionalTopics: [{ topic: 'recovery', when: 'rare' }],
    });
    expect(messages).toHaveLength(2);
    expect(messages[1]!.content.type).toBe('resource');
    if (messages[1]!.content.type !== 'resource') return;
    expect(messages[1]!.content.resource.uri).toBe('lightdash://playbooks/test/discover');
    expect(messages[1]!.content.resource.text).toContain('discover body');
  });

  it('embedded embeds core and required topics', () => {
    const compose = createPromptContextComposer({
      policy: 'embedded',
      invariants: INVARIANTS,
      core,
      topics,
      topicMeta,
    });
    const { messages } = compose({
      task: 'Find content',
      invariantIds: ['project-scope'],
      requiredTopics: ['discover'],
    });
    expect(messages).toHaveLength(3);
    expect(messages.map((m) => (m.content.type === 'resource' ? m.content.resource.uri : 'text'))).toEqual([
      'text',
      'lightdash://playbooks/test/core',
      'lightdash://playbooks/test/discover',
    ]);
  });

  it('throws on unknown invariant or topic', () => {
    const compose = createPromptContextComposer({
      policy: 'compact',
      invariants: INVARIANTS,
      core,
      topics,
      topicMeta,
    });
    expect(() =>
      compose({ task: 'x', invariantIds: ['missing'], requiredTopics: [] }),
    ).toThrow(/Unknown prompt invariant/);
    expect(() =>
      compose({
        task: 'x',
        invariantIds: ['no-mutation'],
        // @ts-expect-error intentional bad topic
        requiredTopics: ['nope'],
      }),
    ).toThrow(/Unknown playbook topic/);
  });

  it('measures compact smaller than embedded', () => {
    const compact = createPromptContextComposer({
      policy: 'compact',
      invariants: INVARIANTS,
      core,
      topics,
      topicMeta,
    });
    const embedded = createPromptContextComposer({
      policy: 'embedded',
      invariants: INVARIANTS,
      core,
      topics,
      topicMeta,
    });
    const spec = {
      task: 'Find content',
      invariantIds: ['no-mutation', 'project-scope'] as const,
      requiredTopics: ['discover'] as const,
    };
    const c = measurePromptMessages(compact(spec).messages);
    const e = measurePromptMessages(embedded(spec).messages);
    expect(c.embeddedResourceCount).toBe(0);
    expect(e.embeddedResourceCount).toBe(2);
    expect(c.totalChars).toBeLessThan(e.totalChars);
  });
});
