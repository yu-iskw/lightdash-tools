import { PROFILE_IDS } from '@lightdash-tools/common';
import { describe, expect, it } from 'vitest';

import {
  AI_AGENT_CHAT_PROFILE_PATH,
  CONTENT_DEVELOPER_PROFILE_PATH,
  CONTENT_READER_PROFILE_PATH,
  getProfile,
  SEMANTIC_LAYER_PROFILE_PATH,
} from '../profiles/index.js';

import {
  UNRESTRICTED_ENABLED_PROFILES,
  isProfileEnabled,
  listEnabledProfilePaths,
  parseEnabledProfiles,
  requiresSignedStateKey,
  resolveRootMcpPath,
} from './enabled-profiles.js';
import { ENV_LIGHTDASH_TOOLS_MCP_PROFILES } from './env.js';

describe('parseEnabledProfiles', () => {
  it('returns unrestricted when unset or empty', () => {
    expect(parseEnabledProfiles(undefined)).toEqual(UNRESTRICTED_ENABLED_PROFILES);
    expect(parseEnabledProfiles('')).toEqual(UNRESTRICTED_ENABLED_PROFILES);
    expect(parseEnabledProfiles('   ')).toEqual(UNRESTRICTED_ENABLED_PROFILES);
  });

  it('parses comma-separated ids with trim and dedupe', () => {
    expect(parseEnabledProfiles(' content-reader , content-developer, content-reader ')).toEqual({
      restricted: true,
      ids: new Set(['content-reader', 'content-developer']),
    });
  });

  it('rejects empty CSV segments', () => {
    expect(() => parseEnabledProfiles(',,,')).toThrow(/empty segments/);
    expect(() => parseEnabledProfiles('content-reader,')).toThrow(/empty segments/);
  });

  it('rejects unknown ids and free-form paths', () => {
    expect(() => parseEnabledProfiles('not-a-profile')).toThrow(/unknown profile/);
    expect(() => parseEnabledProfiles('/content-reader/v1/mcp')).toThrow(/unknown profile/);
    expect(() => parseEnabledProfiles('not-a-profile')).toThrow(ENV_LIGHTDASH_TOOLS_MCP_PROFILES);
  });
});

describe('isProfileEnabled / requiresSignedStateKey / resolveRootMcpPath', () => {
  it('treats unrestricted as all profiles enabled', () => {
    expect(isProfileEnabled(UNRESTRICTED_ENABLED_PROFILES, 'content-governance')).toBe(true);
    expect(isProfileEnabled(UNRESTRICTED_ENABLED_PROFILES, 'data-analyst')).toBe(true);
    expect(isProfileEnabled(UNRESTRICTED_ENABLED_PROFILES, 'ai-agent-chat')).toBe(true);
    expect(requiresSignedStateKey(UNRESTRICTED_ENABLED_PROFILES)).toBe(true);
  });

  it('restricts to listed ids', () => {
    const policy = parseEnabledProfiles('content-reader');
    expect(isProfileEnabled(policy, 'content-reader')).toBe(true);
    expect(isProfileEnabled(policy, 'semantic-layer')).toBe(false);
    expect(requiresSignedStateKey(policy)).toBe(false);
  });

  it('requires signing key when developer or governance is enabled', () => {
    expect(requiresSignedStateKey(parseEnabledProfiles('content-developer'))).toBe(true);
    expect(requiresSignedStateKey(parseEnabledProfiles('content-governance'))).toBe(true);
    expect(requiresSignedStateKey(parseEnabledProfiles('content-reader,content-developer'))).toBe(
      true,
    );
    expect(requiresSignedStateKey(parseEnabledProfiles('ai-agent-chat'))).toBe(false);
  });

  it('uses semantic-layer mcpPath when unrestricted or when that id is listed', () => {
    expect(resolveRootMcpPath(UNRESTRICTED_ENABLED_PROFILES)).toBe(SEMANTIC_LAYER_PROFILE_PATH);
    expect(resolveRootMcpPath(parseEnabledProfiles('semantic-layer,content-reader'))).toBe(
      SEMANTIC_LAYER_PROFILE_PATH,
    );
  });

  it('uses first PROFILE_IDS-enabled path when semantic-layer is omitted', () => {
    expect(resolveRootMcpPath(parseEnabledProfiles('content-reader'))).toBe(
      CONTENT_READER_PROFILE_PATH,
    );
    expect(resolveRootMcpPath(parseEnabledProfiles('content-reader,content-developer'))).toBe(
      CONTENT_DEVELOPER_PROFILE_PATH,
    );
    expect(PROFILE_IDS.indexOf('content-developer')).toBeLessThan(
      PROFILE_IDS.indexOf('content-reader'),
    );
  });

  it('anchors root PRM on ai-agent-chat when it is the first enabled PROFILE_IDS id', () => {
    expect(resolveRootMcpPath(parseEnabledProfiles('ai-agent-chat,ai-agent-ops'))).toBe(
      AI_AGENT_CHAT_PROFILE_PATH,
    );
    expect(PROFILE_IDS.indexOf('ai-agent-chat')).toBeLessThan(PROFILE_IDS.indexOf('ai-agent-ops'));
  });

  it('lists shipped paths when unrestricted and only enabled paths when restricted', () => {
    expect(listEnabledProfilePaths(UNRESTRICTED_ENABLED_PROFILES)).toEqual(
      PROFILE_IDS.map((id) => getProfile(id).path),
    );
    expect(listEnabledProfilePaths(parseEnabledProfiles('content-reader'))).toEqual([
      CONTENT_READER_PROFILE_PATH,
    ]);
  });
});
