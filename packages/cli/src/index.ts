#!/usr/bin/env node
/**
 * Main entry point for Lightdash AI CLI.
 */

import { Command } from 'commander';
import { registerOrganizationCommand } from './commands/organization';
import { registerOrganizationRolesCommand } from './commands/organization-roles';
import { registerProjectsCommand } from './commands/projects';
import { registerProjectRoleAssignmentsCommand } from './commands/project-role-assignments';
import { registerProjectAccessCommand } from './commands/project-access';
import { registerSpacesCommand } from './commands/spaces';
import { registerSpaceAccessCommand } from './commands/space-access';
import { registerChartsCommand } from './commands/charts';
import { registerDashboardsCommand } from './commands/dashboards';
import { registerAiAgentsCommand } from './commands/ai-agents';
import { registerAgentsCommand } from './commands/agents';
import { registerGroupsCommand } from './commands/groups';
import { registerUsersCommand } from './commands/users';
import { registerQueryCommand } from './commands/query';
import { registerExploresCommand } from './commands/explores';
import { registerMetricsCommand } from './commands/metrics';
import { registerSchedulersCommand } from './commands/schedulers';
import { registerTagsCommand } from './commands/tags';
import { registerContentCommand } from './commands/content';

const program = new Command();

program
  .name('lightdash-ai')
  .description('CLI for Lightdash AI')
  .version('0.2.6')
  .option(
    '--safety-mode <mode>',
    'Safety mode (read-only, write-idempotent, write-destructive)',
    'read-only',
  );

// Register all commands (organization and projects first so subcommands can attach)
registerOrganizationCommand(program);
registerOrganizationRolesCommand(program);
registerProjectsCommand(program);
registerProjectRoleAssignmentsCommand(program);
registerProjectAccessCommand(program);
registerSpacesCommand(program);
registerSpaceAccessCommand(program);
registerChartsCommand(program);
registerDashboardsCommand(program);
registerAiAgentsCommand(program);
registerAgentsCommand(program);
registerGroupsCommand(program);
registerUsersCommand(program);
registerQueryCommand(program);
registerExploresCommand(program);
registerMetricsCommand(program);
registerSchedulersCommand(program);
registerTagsCommand(program);
registerContentCommand(program);

// Parse command line arguments
program.parse(process.argv);
