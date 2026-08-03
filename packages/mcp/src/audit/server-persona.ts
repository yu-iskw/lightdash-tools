/**
 * Bind an MCP server instance to a persona id for audit attribution and
 * persona-aware tool registration (envelopes, get_project capabilities).
 * Call once in registerCapabilities before registering tools; registerToolSafe
 * and tool registrars read it via getServerPersona / requireServerPersona.
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

/** Fail closed when a registrar runs without bindServerPersona. */
export function requireServerPersona(server: object, toolId: string): string {
  const persona = getServerPersona(server);
  if (!persona) {
    throw new Error(`personaId is required to register ${toolId}`);
  }
  return persona;
}
