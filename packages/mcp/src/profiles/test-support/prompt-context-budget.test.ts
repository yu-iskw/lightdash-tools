/**
 * Cross-profile prompt-context budget gates (deterministic; RFC).
 */

import { describe, expect, it } from 'vitest';

import {
  CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS,
  CONTENT_DEVELOPER_INVARIANTS,
} from '../content-developer/v1/invariants.js';
import {
  CONTENT_DEVELOPER_CORE_PLAYBOOK,
  CONTENT_DEVELOPER_TOPIC_META,
  CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
} from '../content-developer/v1/resources/playbooks.js';
import {
  CONTENT_READER_DEFAULT_INVARIANT_IDS,
  CONTENT_READER_INVARIANTS,
} from '../content-reader/v1/invariants.js';
import {
  CONTENT_READER_CORE_PLAYBOOK,
  CONTENT_READER_TOPIC_META,
  CONTENT_READER_TOPIC_PLAYBOOKS,
} from '../content-reader/v1/resources/playbooks.js';
import {
  createPromptContextComposer,
  measurePromptMessages,
  approxTokensFromChars,
} from '../lib/prompt-context.js';

import type { PromptContextPolicy } from '../../config/prompt-context-policy.js';
import type { EmbeddedPlaybook, PromptTopicMeta } from '../lib/playbook-resources.js';
import type { PromptContextSpec } from '../lib/prompt-context.js';
import type { PromptInvariant } from '../lib/prompt-invariants.js';

type Scenario = {
  profile: string;
  prompt: string;
  invariants: readonly PromptInvariant[];
  core: EmbeddedPlaybook;
  topics: Readonly<Record<string, EmbeddedPlaybook>>;
  topicMeta: Readonly<Record<string, PromptTopicMeta>>;
  spec: PromptContextSpec<string>;
};

const SCENARIOS: Scenario[] = [
  {
    profile: 'content-reader',
    prompt: 'find_content',
    invariants: CONTENT_READER_INVARIANTS,
    core: CONTENT_READER_CORE_PLAYBOOK,
    topics: CONTENT_READER_TOPIC_PLAYBOOKS,
    topicMeta: CONTENT_READER_TOPIC_META,
    spec: {
      task: `Find the most relevant Lightdash content for:\n\nrevenue by region\n\nProject: pin.\nVerified preference: false.\n\nWorkflow:\nresolve → search → rank → ≤5.`,
      invariantIds: CONTENT_READER_DEFAULT_INVARIANT_IDS,
      requiredTopics: ['discover'],
    },
  },
  {
    profile: 'content-developer',
    prompt: 'create_dashboard',
    invariants: CONTENT_DEVELOPER_INVARIANTS,
    core: CONTENT_DEVELOPER_CORE_PLAYBOOK,
    topics: CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
    topicMeta: CONTENT_DEVELOPER_TOPIC_META,
    spec: {
      task: `Create a new dashboard for:\n\nexecutive revenue overview\n\nProject: pin.\n\nWorkflow:\nDesign Spec → approval → preview → confirm → apply.`,
      invariantIds: CONTENT_DEVELOPER_DEFAULT_INVARIANT_IDS,
      requiredTopics: ['dashboards', 'dashboard-design', 'chart-types'],
      recoveryTopics: [
        {
          topic: 'recovery/preview-stale',
          when: 'PREVIEW_STALE',
        },
      ],
    },
  },
];

function metricsForScenario(scenario: Scenario) {
  const byPolicy = {} as Record<PromptContextPolicy, ReturnType<typeof measurePromptMessages>>;
  for (const policy of ['compact', 'compatible', 'embedded'] as const) {
    const compose = createPromptContextComposer({
      policy,
      invariants: scenario.invariants,
      core: scenario.core,
      topics: scenario.topics,
      topicMeta: scenario.topicMeta,
    });
    byPolicy[policy] = measurePromptMessages(compose(scenario.spec).messages);
  }
  return byPolicy;
}

describe('prompt context budgets', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.profile}/${scenario.prompt}: compact has no embeds and beats embedded by ≥40%`, () => {
      const { compact, embedded } = metricsForScenario(scenario);
      expect(compact.embeddedResourceCount).toBe(0);
      expect(embedded.embeddedResourceCount).toBeGreaterThan(0);
      const reduction = 1 - compact.totalChars / embedded.totalChars;
      expect(reduction).toBeGreaterThanOrEqual(0.4);
      expect(approxTokensFromChars(compact.totalChars)).toBeLessThanOrEqual(1500);
    });

    it(`${scenario.profile}/${scenario.prompt}: compatible embeds only required topics`, () => {
      const { compatible, embedded } = metricsForScenario(scenario);
      expect(compatible.embeddedResourceCount).toBe(scenario.spec.requiredTopics?.length ?? 0);
      expect(compatible.totalChars).toBeLessThan(embedded.totalChars);
    });
  }
});
