import { CLIENT_CAPABILITIES_META_KEY } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';

import { supportsFormElicitation } from './capability.js';

import type { ClientCapabilities, ServerContext } from '@modelcontextprotocol/server';

function serverContextWithEnvelopeCaps(
  elicitation: ClientCapabilities['elicitation'] | undefined,
): ServerContext {
  const envelope =
    elicitation === undefined ? {} : { [CLIENT_CAPABILITIES_META_KEY]: { elicitation } };
  return {
    mcpReq: {
      envelope,
    },
  } as unknown as ServerContext;
}

describe('supportsFormElicitation', () => {
  it('returns false when ServerContext and initialize caps are missing', () => {
    expect(supportsFormElicitation(undefined)).toBe(false);
  });

  it('returns false when elicitation capability is absent from envelope', () => {
    expect(supportsFormElicitation(serverContextWithEnvelopeCaps(undefined))).toBe(false);
  });

  it('returns true for empty elicitation object on the envelope (form-only backwards-compat)', () => {
    expect(supportsFormElicitation(serverContextWithEnvelopeCaps({}))).toBe(true);
  });

  it('returns true when form mode is declared on the envelope', () => {
    expect(supportsFormElicitation(serverContextWithEnvelopeCaps({ form: {} }))).toBe(true);
  });

  it('returns false when only url mode is declared on the envelope', () => {
    expect(supportsFormElicitation(serverContextWithEnvelopeCaps({ url: {} }))).toBe(false);
  });

  it('falls back to initialize-declared capabilities when envelope has no elicitation', () => {
    expect(
      supportsFormElicitation(serverContextWithEnvelopeCaps(undefined), {
        elicitation: { form: {} },
      }),
    ).toBe(true);
    expect(
      supportsFormElicitation(undefined, {
        elicitation: {},
      }),
    ).toBe(true);
    expect(
      supportsFormElicitation(undefined, {
        elicitation: { url: {} },
      }),
    ).toBe(false);
  });

  it('prefers envelope over initialize caps when both are present', () => {
    expect(
      supportsFormElicitation(serverContextWithEnvelopeCaps({ url: {} }), {
        elicitation: { form: {} },
      }),
    ).toBe(false);
  });
});
