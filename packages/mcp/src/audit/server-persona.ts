/**
 * Bind an MCP server instance to a persona id for audit attribution.
 * Call once in registerCapabilities before registering tools; registerToolSafe
 * reads it at wrap time. Tool behavior that needs personaId still uses
 * registerToolsByIds options (e.g. get_project) — that path is separate.
 */

const serverPersona = new WeakMap<object, string>();

/** Associate a persona id with an MCP server (call before registering tools). */
export function bindServerPersona(server: object, personaId: string): void {
  serverPersona.set(server, personaId);
}

/** Persona id bound to this server, if any. */
export function getServerPersona(server: object): string | undefined {
  return serverPersona.get(server);
}
