import { parseLightdashAiAgentBundle, parseLightdashAiEvaluationGate } from './types';

/** True when MCP tool args carry AgentOps YAML documents that imply a project scope. */
export function hasYamlProjectDocumentArgs(args: unknown): boolean {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    return false;
  }
  const record = args as Record<string, unknown>;
  return typeof record.bundleYaml === 'string' || typeof record.gateYaml === 'string';
}

/**
 * Extracts project UUIDs from MCP tool args, including YAML document fields
 * (`bundleYaml`, `gateYaml`) used by AgentOps composite tools.
 */
export function extractProjectUuidsFromToolArgs(args: unknown): string[] {
  const uuids: string[] = [];

  if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
    const record = args as Record<string, unknown>;

    if (typeof record.bundleYaml === 'string') {
      try {
        const bundle = parseLightdashAiAgentBundle(record.bundleYaml);
        uuids.push(bundle.spec.projectUuid);
      } catch {
        // Handler validates YAML; allowlist runs before handler may see invalid YAML.
      }
    }

    if (typeof record.gateYaml === 'string') {
      try {
        const gate = parseLightdashAiEvaluationGate(record.gateYaml);
        uuids.push(gate.spec.projectUuid);
      } catch {
        // Same as bundleYaml — parse errors surface in the handler.
      }
    }
  }

  return uuids;
}
