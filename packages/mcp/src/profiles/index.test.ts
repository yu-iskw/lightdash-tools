import { IRRECOVERABLE_TOOL_DENYLIST, PROFILE_IDS } from '@lightdash-tools/common';
import { describe, expect, it, vi } from 'vitest';

import { listProjectsTool } from '../tools/project/projects.js';
import { registerTools } from '../tools/registry.js';
import { compileQueryTool } from '../tools/semantic/query.js';
import { TOOL_PREFIX } from '../tools/shared.js';

import {
  AI_AGENT_OPS_PROFILE_PATH,
  CONTENT_DEVELOPER_PROFILE_PATH,
  CONTENT_GOVERNANCE_PROFILE_PATH,
  CONTENT_READER_PROFILE_PATH,
  DATA_ANALYST_PROFILE_PATH,
  DEFAULT_PROFILE_ID,
  getDefaultProfile,
  getProfile,
  getProfileByPath,
  getProfileServerName,
  listProfilePaths,
  listToolIds,
  ORGANIZATION_AUDIT_PROFILE_PATH,
  parseProfileId,
  PROFILES,
  SEMANTIC_LAYER_PROFILE_PATH,
} from './index.js';

describe('profiles', () => {
  it('ships seven profiles with fixed paths and matching keys', () => {
    expect(Object.keys(PROFILES).sort()).toEqual([...PROFILE_IDS].sort());
    for (const [key, profile] of Object.entries(PROFILES)) {
      expect(profile.id).toBe(key);
      expect(profile.tools.length).toBeGreaterThan(0);
    }
    expect(DEFAULT_PROFILE_ID).toBe('semantic-layer');
    expect(listProfilePaths().sort()).toEqual(
      [
        AI_AGENT_OPS_PROFILE_PATH,
        CONTENT_DEVELOPER_PROFILE_PATH,
        CONTENT_GOVERNANCE_PROFILE_PATH,
        CONTENT_READER_PROFILE_PATH,
        DATA_ANALYST_PROFILE_PATH,
        ORGANIZATION_AUDIT_PROFILE_PATH,
        SEMANTIC_LAYER_PROFILE_PATH,
      ].sort(),
    );
    expect(getProfileByPath(SEMANTIC_LAYER_PROFILE_PATH)?.id).toBe('semantic-layer');
    expect(getProfileByPath(ORGANIZATION_AUDIT_PROFILE_PATH)?.id).toBe('organization-audit');
    expect(getProfileByPath(CONTENT_READER_PROFILE_PATH)?.id).toBe('content-reader');
    expect(getProfileByPath(CONTENT_DEVELOPER_PROFILE_PATH)?.id).toBe('content-developer');
    expect(getProfileByPath(CONTENT_GOVERNANCE_PROFILE_PATH)?.id).toBe('content-governance');
    expect(getProfileByPath(AI_AGENT_OPS_PROFILE_PATH)?.id).toBe('ai-agent-ops');
    expect(getProfileByPath(DATA_ANALYST_PROFILE_PATH)?.id).toBe('data-analyst');
    expect(getProfileByPath('/mcp')).toBeUndefined();
  });

  it('normalizes trailing slashes when resolving path', () => {
    expect(getProfileByPath(`${SEMANTIC_LAYER_PROFILE_PATH}/`)?.id).toBe('semantic-layer');
    expect(getProfileByPath(`${ORGANIZATION_AUDIT_PROFILE_PATH}/`)?.id).toBe('organization-audit');
    expect(getProfileByPath(`${CONTENT_READER_PROFILE_PATH}/`)?.id).toBe('content-reader');
    expect(getProfileByPath(`${CONTENT_DEVELOPER_PROFILE_PATH}/`)?.id).toBe('content-developer');
    expect(getProfileByPath(`${CONTENT_GOVERNANCE_PROFILE_PATH}/`)?.id).toBe('content-governance');
    expect(getProfileByPath(`${AI_AGENT_OPS_PROFILE_PATH}/`)?.id).toBe('ai-agent-ops');
    expect(getProfileByPath(`${DATA_ANALYST_PROFILE_PATH}/`)?.id).toBe('data-analyst');
  });

  it('semantic-layer mounts exactly nine tools', () => {
    expect(listToolIds(getProfile('semantic-layer'))).toHaveLength(9);
    expect(getDefaultProfile().id).toBe('semantic-layer');
  });

  it('organization-audit membership and short server name', () => {
    const profile = getProfile('organization-audit');
    expect(listToolIds(profile)).toHaveLength(18);
    expect(getProfileServerName(profile)).toBe('lightdash-mcp-org-audit');
  });

  it('content-reader membership and server name', () => {
    const profile = getProfile('content-reader');
    expect(listToolIds(profile)).toHaveLength(14);
    expect(listToolIds(profile)).not.toContain('export_chart_image');
    expect(listToolIds(profile)).toContain('list_verified_content');
    expect(getProfileServerName(profile)).toBe('lightdash-mcp-content');
  });

  it('content-developer membership and short server name', () => {
    const profile = getProfile('content-developer');
    const tools = listToolIds(profile);
    expect(tools).toContain('get_chart_as_code');
    expect(tools).not.toContain('create_space');
    expect(tools).not.toContain('update_space');
    expect(getProfileServerName(profile)).toBe('lightdash-mcp-cdev');
  });

  it('content-governance membership and short server name', () => {
    const profile = getProfile('content-governance');
    expect([...listToolIds(profile)].sort()).toEqual(
      [
        'delete_chart',
        'delete_dashboard',
        'get_dashboard_promote_diff',
        'promote_dashboard',
      ].sort(),
    );
    expect(getProfileServerName(profile)).toBe('lightdash-mcp-gov');
  });

  it('ai-agent-ops membership and short server name', () => {
    const profile = getProfile('ai-agent-ops');
    const tools = listToolIds(profile);
    expect(tools).toHaveLength(17);
    expect(tools).not.toContain('create_project_agent');
    expect(tools).not.toContain('generate_agent_message');
    expect(getProfileServerName(profile)).toBe('lightdash-mcp-aops');
  });

  it('data-analyst membership and short server name', () => {
    const profile = getProfile('data-analyst');
    const tools = listToolIds(profile);
    expect(tools).toHaveLength(9);
    expect(tools).toContain('run_metric_query');
    expect(tools).not.toContain('run_chart');
    expect(getProfileServerName(profile)).toBe('lightdash-mcp-analyst');
  });

  it('keeps combined server+tool wire names under 60 characters', () => {
    for (const profile of Object.values(PROFILES)) {
      const serverName = getProfileServerName(profile);
      for (const id of listToolIds(profile)) {
        const combined = serverName.length + (TOOL_PREFIX + id).length;
        expect(combined, `${serverName}+${TOOL_PREFIX}${id}`).toBeLessThanOrEqual(60);
      }
    }
  });

  it('parseProfileId validates known ids only', () => {
    expect(parseProfileId('semantic-layer')).toBe('semantic-layer');
    expect(parseProfileId('organization-audit')).toBe('organization-audit');
    expect(parseProfileId('content-reader')).toBe('content-reader');
    expect(parseProfileId('content-developer')).toBe('content-developer');
    expect(parseProfileId('content-governance')).toBe('content-governance');
    expect(parseProfileId('ai-agent-ops')).toBe('ai-agent-ops');
    expect(parseProfileId('data-analyst')).toBe('data-analyst');
    expect(parseProfileId('nope')).toBeUndefined();
  });

  it('registerTools registers mounted modules', () => {
    const registered: string[] = [];
    const mockServer = {
      registerTool: vi.fn((name: string) => {
        registered.push(name);
      }),
    };
    const mockCtx = { getContext: async () => ({ lightdashClient: {} }) };

    registerTools(mockServer as never, mockCtx as never, [listProjectsTool, compileQueryTool]);

    expect(registered).toEqual([`${TOOL_PREFIX}list_projects`, `${TOOL_PREFIX}compile_query`]);
  });

  it('profile tools have unique ids and are not on the denylist', () => {
    const banned = new Set<string>(IRRECOVERABLE_TOOL_DENYLIST);
    for (const profile of Object.values(PROFILES)) {
      const ids = listToolIds(profile);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(banned.has(id)).toBe(false);
      }
    }
  });
});
