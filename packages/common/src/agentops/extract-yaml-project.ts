import { parseLightdashAiAgentBundle, parseLightdashAiEvaluationGate } from './types';

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
