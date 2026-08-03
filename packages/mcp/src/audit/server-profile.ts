/**
 * Bind an MCP server instance to a profile id for audit attribution and
 * profile-aware tool registration (envelopes, get_project capabilities).
 * Call once in registerCapabilities before registering tools; registerToolSafe
 * and tool registrars read it via getServerProfile / requireServerProfile.
 */

import type { ProfileId } from '@lightdash-tools/common';

const serverProfile = new WeakMap<object, ProfileId>();

/** Associate a profile id with an MCP server (call before registering tools). */
export function bindServerProfile(server: object, profileId: ProfileId): void {
  serverProfile.set(server, profileId);
}

/** Profile id bound to this server, if any. */
export function getServerProfile(server: object): ProfileId | undefined {
  return serverProfile.get(server);
}

/** Fail closed when a registrar runs without bindServerProfile. */
export function requireServerProfile(server: object, toolId: string): ProfileId {
  const profile = getServerProfile(server);
  if (!profile) {
    throw new Error(`profileId is required to register ${toolId}`);
  }
  return profile;
}
