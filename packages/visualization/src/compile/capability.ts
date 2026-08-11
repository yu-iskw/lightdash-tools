/**
 * Target capability matrices and negotiation.
 */

import { VisualizationError } from '../errors';

import type { VisualizationWarning } from '../errors';
import type {
  VisualizationCapability,
  VisualizationCapabilitiesSpec,
  VisualizationInteraction,
} from '../spec/types';

export type CompileTarget = 'svg' | 'standalone-html' | 'lightdash-custom-chart';

const TARGET_CAPABILITIES: Record<CompileTarget, ReadonlySet<VisualizationCapability>> = {
  svg: new Set(['responsiveLayout']),
  'standalone-html': new Set(['tooltip', 'selection', 'responsiveLayout']),
  'lightdash-custom-chart': new Set(['tooltip', 'responsiveLayout']),
};

export function capabilitiesForTarget(target: CompileTarget): ReadonlySet<VisualizationCapability> {
  return TARGET_CAPABILITIES[target];
}

export interface CapabilityNegotiationResult {
  supported: VisualizationCapability[];
  degraded: VisualizationCapability[];
  warnings: VisualizationWarning[];
}

function collectRequestedCapabilities(
  interaction: VisualizationInteraction | undefined,
  capabilities: VisualizationCapabilitiesSpec | undefined,
): { required: VisualizationCapability[]; preferred: VisualizationCapability[] } {
  const required = new Set<VisualizationCapability>(capabilities?.required ?? []);
  const preferred = new Set<VisualizationCapability>(capabilities?.preferred ?? []);

  if (interaction?.tooltip) preferred.add('tooltip');
  if (interaction?.selection) {
    preferred.add('selection');
    if (interaction.selection.type === 'multiple') preferred.add('multiSelection');
  }
  for (const binding of interaction?.actions ?? []) {
    preferred.add(binding.action.type as VisualizationCapability);
  }

  return {
    required: [...required],
    preferred: [...preferred],
  };
}

export function negotiateCapabilities(input: {
  target: CompileTarget;
  interaction?: VisualizationInteraction;
  capabilities?: VisualizationCapabilitiesSpec;
  strict?: boolean;
}): CapabilityNegotiationResult {
  const supportedSet = capabilitiesForTarget(input.target);
  const { required, preferred } = collectRequestedCapabilities(
    input.interaction,
    input.capabilities,
  );

  const warnings: VisualizationWarning[] = [];
  const degraded: VisualizationCapability[] = [];
  const supported: VisualizationCapability[] = [];

  for (const cap of required) {
    if (!supportedSet.has(cap)) {
      if (input.strict !== false) {
        throw new VisualizationError(
          'UNSUPPORTED_REQUIRED_CAPABILITY',
          `Required capability "${cap}" is not supported by target "${input.target}"`,
          { capability: cap, target: input.target },
        );
      }
      degraded.push(cap);
      warnings.push({
        code: 'CAPABILITY_DEGRADED',
        message: `Required capability "${cap}" unavailable on ${input.target} (non-strict)`,
        details: { capability: cap, target: input.target },
      });
    } else {
      supported.push(cap);
    }
  }

  for (const cap of preferred) {
    if (required.includes(cap)) continue;
    if (!supportedSet.has(cap)) {
      degraded.push(cap);
      warnings.push({
        code: 'CAPABILITY_DEGRADED',
        message: `Preferred capability "${cap}" unavailable on ${input.target}`,
        details: { capability: cap, target: input.target },
      });
    } else {
      supported.push(cap);
    }
  }

  return { supported, degraded, warnings };
}
