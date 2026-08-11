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

export type CompileTarget = 'lightdash-custom-chart' | 'standalone-html' | 'svg';

export const COMPILE_TARGETS = [
  'svg',
  'standalone-html',
  'lightdash-custom-chart',
] as const satisfies readonly CompileTarget[];

export function isCompileTarget(value: string): value is CompileTarget {
  return (COMPILE_TARGETS as readonly string[]).includes(value);
}

/**
 * Only advertise capabilities the MVP renderers actually implement.
 * Tooltip/selection/responsiveLayout are deferred until wired end-to-end.
 */
const TARGET_CAPABILITIES: Record<CompileTarget, ReadonlySet<VisualizationCapability>> = {
  svg: new Set(),
  'standalone-html': new Set(),
  'lightdash-custom-chart': new Set(),
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
    const actionCap: VisualizationCapability = binding.action.type;
    preferred.add(actionCap);
  }

  return {
    required: [...required],
    preferred: [...preferred],
  };
}

function recordCapability(input: {
  cap: VisualizationCapability;
  supportedSet: ReadonlySet<VisualizationCapability>;
  supported: VisualizationCapability[];
  degraded: VisualizationCapability[];
  warnings: VisualizationWarning[];
  target: CompileTarget;
  required: boolean;
  strict: boolean;
}): void {
  const { cap, supportedSet, supported, degraded, warnings, target, required, strict } = input;
  if (supportedSet.has(cap)) {
    supported.push(cap);
    return;
  }
  if (required && strict) {
    throw new VisualizationError(
      'UNSUPPORTED_REQUIRED_CAPABILITY',
      `Required capability "${cap}" is not supported by target "${target}"`,
      { capability: cap, target },
    );
  }
  degraded.push(cap);
  warnings.push({
    code: 'CAPABILITY_DEGRADED',
    message: required
      ? `Required capability "${cap}" unavailable on ${target} (non-strict)`
      : `Preferred capability "${cap}" unavailable on ${target}`,
    details: { capability: cap, target },
  });
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
  const strict = input.strict !== false;

  for (const cap of required) {
    recordCapability({
      cap,
      supportedSet,
      supported,
      degraded,
      warnings,
      target: input.target,
      required: true,
      strict,
    });
  }

  for (const cap of preferred) {
    if (required.includes(cap)) continue;
    recordCapability({
      cap,
      supportedSet,
      supported,
      degraded,
      warnings,
      target: input.target,
      required: false,
      strict,
    });
  }

  return { supported, degraded, warnings };
}
