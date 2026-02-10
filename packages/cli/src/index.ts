#!/usr/bin/env node
/**
 * Main entry point for Lightdash AI CLI.
 */

import { Command } from 'commander';
import { registerOrganizationCommand } from './commands/organization';
import { registerProjectsCommand } from './commands/projects';
import { registerGroupsCommand } from './commands/groups';
import { registerUsersCommand } from './commands/users';

const program = new Command();

program.name('lightdash-ai').description('CLI for Lightdash AI').version('1.0.0');

// Register all commands
registerOrganizationCommand(program);
registerProjectsCommand(program);
registerGroupsCommand(program);
registerUsersCommand(program);

// Parse command line arguments
program.parse(process.argv);
