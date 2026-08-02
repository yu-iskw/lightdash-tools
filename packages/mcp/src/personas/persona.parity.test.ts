import { listMcpToolNamesByProfile } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import { CONTENT_DEVELOPER_TOOL_IDS } from './content-developer/v1/index.js';
import { CONTENT_GOVERNANCE_TOOL_IDS } from './content-governance/v1/index.js';
import { CONTENT_READER_TOOL_IDS } from './content-reader/v1/index.js';
import { ORGANIZATION_AUDIT_TOOL_IDS } from './organization-audit/v1/index.js';
import { SEMANTIC_LAYER_TOOL_IDS } from './semantic-layer/v1/index.js';

describe('persona catalog parity', () => {
  it('semantic-layer allowlist matches catalog semantic-discovery profile', () => {
    expect([...SEMANTIC_LAYER_TOOL_IDS].sort()).toEqual(
      [...listMcpToolNamesByProfile('semantic-discovery')].sort(),
    );
  });

  it('organization-audit allowlist matches catalog org-audit-readonly profile', () => {
    expect([...ORGANIZATION_AUDIT_TOOL_IDS].sort()).toEqual(
      [...listMcpToolNamesByProfile('org-audit-readonly')].sort(),
    );
  });

  it('content-reader allowlist matches catalog content-reader profile', () => {
    expect([...CONTENT_READER_TOOL_IDS].sort()).toEqual(
      [...listMcpToolNamesByProfile('content-reader')].sort(),
    );
  });

  it('content-developer allowlist matches catalog content-developer profile', () => {
    expect([...CONTENT_DEVELOPER_TOOL_IDS].sort()).toEqual(
      [...listMcpToolNamesByProfile('content-developer')].sort(),
    );
  });

  it('content-governance allowlist matches catalog content-governance profile', () => {
    expect([...CONTENT_GOVERNANCE_TOOL_IDS].sort()).toEqual(
      [...listMcpToolNamesByProfile('content-governance')].sort(),
    );
  });
});
