import type { Command } from 'commander';

/** Merge parent + subcommand opts (Commander 15 puts shared flags on the parent). */
export function resolveCliOptions(
  command: Command,
  subcommandOptions: { projects?: string; pinProject?: string } = {},
): { projects?: string; pinProject?: string } {
  const parentOpts = (command.parent?.opts() ?? {}) as {
    projects?: string;
    pinProject?: string;
  };
  return {
    projects: subcommandOptions.projects ?? parentOpts.projects,
    pinProject: subcommandOptions.pinProject ?? parentOpts.pinProject,
  };
}
