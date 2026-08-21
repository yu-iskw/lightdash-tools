/**
 * AI-agent-chat prompt/playbook invariants.
 */

import { describe, expect, it } from 'vitest';

import { expectPlaybookCoversProfileTools } from '../../test-support/playbook-invariants.js';

import { AI_AGENT_CHAT_INVARIANTS } from './invariants.js';
import { AI_AGENT_CHAT_HARD_BANS, getAllPlaybookMarkdown } from './resources/playbooks.js';

describe('ai-agent-chat prompts/playbook', () => {
  it('playbook references registered tools and hard bans', () => {
    const md = getAllPlaybookMarkdown();
    expectPlaybookCoversProfileTools('ai-agent-chat', md);
    expect(md.toLowerCase()).toContain('hard bans');
    expect(AI_AGENT_CHAT_HARD_BANS.toLowerCase()).toContain('sql mode');
    expect(AI_AGENT_CHAT_HARD_BANS.toLowerCase()).toContain('evaluations');
  });

  it('conversation playbook teaches preference then list, two-call new chat, follow-up message, and no data-analyst fallback', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toContain('get_user_agent_preferences');
    expect(md).toContain('create_agent_thread');
    expect(md).toContain('create_agent_thread_message');
    expect(md).toContain('generate_agent_response');
    expect(md).toContain('includemessagetext');
    expect(md).toContain('data-analyst');
    expect(md).toContain('open-world');
    expect(md).toMatch(/empty create fails|prompt \(required|exact.*user prompt/);
    expect(md).toMatch(/do \*\*not\*\* call `create_agent_thread_message` on the first turn/);
  });

  it('new-by-default: plain questions create a thread; follow-up needs a known threadUuid', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    expect(md).toMatch(/new conversation|default/);
    expect(md).toContain('create_agent_thread');
    expect(md).toMatch(/known thread|threaduuid|this.session|this session/);
    expect(md).not.toMatch(/else\s+list_agent_threads/);
    expect(md).not.toMatch(/otherwise\s+list_agent_threads/);
  });

  it('forbids cross-user takeover and allUsers thread listing in playbook and invariants', () => {
    const md = getAllPlaybookMarkdown().toLowerCase();
    const bans = AI_AGENT_CHAT_HARD_BANS.toLowerCase();
    const ownScope = AI_AGENT_CHAT_INVARIANTS.find((i) => i.id === 'own-thread-scope');
    expect(ownScope).toBeDefined();
    expect(ownScope!.short.toLowerCase()).toMatch(/allusers|cross-user|take.?over/);
    expect(md).toContain('allusers');
    expect(bans).toContain('allusers');
    expect(md).toMatch(/caller-visible|current (user|lightdash identity)|own/);
    expect(md).toMatch(/do not (seek|attempt|enable).{0,40}(allusers|cross-user|take.?over)/);
    expect(md).not.toMatch(/pass\s+allusers|set\s+allusers|allusers\s*=\s*true/);
  });
});
