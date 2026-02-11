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
import { registerChartsCommand } from './commands/charts';
import { registerDashboardsCommand } from './commands/dashboards';
import { registerAiAgentsCommand } from './commands/ai-agents';
import { registerGroupsCommand } from './commands/groups';
import { registerUsersCommand } from './commands/users';
import { registerQueryCommand } from './commands/query';
import { registerExploresCommand } from './commands/explores';

const program = new Command();

program.name('lightdash-ai').description('CLI for Lightdash AI').version('1.0.0');

// Register all commands (organization and projects first so subcommands can attach)
registerOrganizationCommand(program);
registerOrganizationRolesCommand(program);
registerProjectsCommand(program);
registerProjectRoleAssignmentsCommand(program);
registerProjectAccessCommand(program);
registerSpacesCommand(program);
registerChartsCommand(program);
registerDashboardsCommand(program);
registerAiAgentsCommand(program);
registerGroupsCommand(program);
registerUsersCommand(program);
registerQueryCommand(program);
registerExploresCommand(program);

// Parse command line arguments
program.parse(process.argv);
