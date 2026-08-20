/**
 * AI-agent-chat prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { expectPlaybookCoversProfileTools } from '../../test-support/playbook-invariants.js';

import { AI_AGENT_CHAT_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

describe('ai-agent-chat prompts/playbook', () => {
  it('playbook references registered tools and hard bans', () => {
    const md = getAllPlaybookMarkdown();
    expectPlaybookCoversProfileTools('ai-agent-chat', md);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(AI_AGENT_CHAT_HARD_BANS.toLowerCase()).toContain('sql mode');
    expect(AI_AGENT_CHAT_HARD_BANS.toLowerCase()).toContain('evaluations');
  });

  it('conversation playbook teaches preference then list, three-call new chat, and no data-analyst fallback', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('get_user_agent_preferences');
    expect(md).toContain('create_agent_thread');
    expect(md).toContain('create_agent_thread_message');
    expect(md).toContain('generate_agent_response');
    expect(md).toContain('includemessagetext');
    expect(md).toContain('data-analyst');
    expect(md).toContain('open-world');
  });
});
