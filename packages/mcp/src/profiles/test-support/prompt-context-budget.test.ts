/**
 * Cross-profile prompt-context budget gates (deterministic; RFC).
 * Specs come from production builders — not abbreviated stubs.
 */

import { describe, expect, it } from 'vitest';

import { CONTENT_DEVELOPER_INVARIANTS } from '../content-developer/v1/invariants.js';
import { buildCreateDashboardPromptSpec } from '../content-developer/v1/prompt-specs.js';
import {
  CONTENT_DEVELOPER_CORE_PLAYBOOK,
  CONTENT_DEVELOPER_TOPIC_META,
  CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
} from '../content-developer/v1/resources/playbooks.js';
import { CONTENT_READER_INVARIANTS } from '../content-reader/v1/invariants.js';
import { buildFindContentPromptSpec } from '../content-reader/v1/prompt-specs.js';
import {
  CONTENT_READER_CORE_PLAYBOOK,
  CONTENT_READER_TOPIC_META,
  CONTENT_READER_TOPIC_PLAYBOOKS,
} from '../content-reader/v1/resources/playbooks.js';
import {
  bindProfilePromptContext,
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
    spec: buildFindContentPromptSpec({
      question: 'revenue by region',
      projectUuid: 'pin',
      verifiedOnly: false,
    }),
  },
  {
    profile: 'content-developer',
    prompt: 'create_dashboard',
    invariants: CONTENT_DEVELOPER_INVARIANTS,
    core: CONTENT_DEVELOPER_CORE_PLAYBOOK,
    topics: CONTENT_DEVELOPER_TOPIC_PLAYBOOKS,
    topicMeta: CONTENT_DEVELOPER_TOPIC_META,
    spec: buildCreateDashboardPromptSpec({
      goal: 'executive revenue overview',
      projectUuid: 'pin',
    }),
  },
];

function metricsForScenario(scenario: Scenario) {
  const bind = bindProfilePromptContext({
    invariants: scenario.invariants,
    core: scenario.core,
    topics: scenario.topics,
    topicMeta: scenario.topicMeta,
  });
  const byPolicy = {} as Record<PromptContextPolicy, ReturnType<typeof measurePromptMessages>>;
  for (const policy of ['compact', 'compatible', 'embedded'] as const) {
    byPolicy[policy] = measurePromptMessages(bind(policy)(scenario.spec).messages);
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
