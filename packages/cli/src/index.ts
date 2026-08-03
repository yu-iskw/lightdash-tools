#!/usr/bin/env node
/**
 * Main entry point for Lightdash AI CLI.
 */

import { initAuditLog } from '@lightdash-tools/common';
import { Command } from 'commander';

import { registerAgentopsCommand } from './commands/agentops';
import { registerAgentsCommand } from './commands/agents';
import { registerAiAgentsCommand } from './commands/ai-agents';
import { registerChartsCommand } from './commands/charts';
import { registerContentCommand } from './commands/content';
import { registerDashboardsCommand } from './commands/dashboards';
import { registerExploresCommand } from './commands/explores';
import { registerGroupsCommand } from './commands/groups';
import { registerMetricsCommand } from './commands/metrics';
import { registerOrganizationCommand } from './commands/organization';
import { registerOrganizationRolesCommand } from './commands/organization-roles';
import { registerProjectAccessCommand } from './commands/project-access';
import { registerProjectRoleAssignmentsCommand } from './commands/project-role-assignments';
import { registerProjectsCommand } from './commands/projects';
import { registerQueryCommand } from './commands/query';
import { registerSchedulersCommand } from './commands/schedulers';
import { registerSchemaCommand } from './commands/schema';
import { registerSpaceAccessCommand } from './commands/space-access';
import { registerSpacesCommand } from './commands/spaces';
import { registerTagsCommand } from './commands/tags';
import { registerUsersCommand } from './commands/users';

// Initialise audit log before any command runs (uses LIGHTDASH_TOOLS_AUDIT_LOG env var).
initAuditLog(process.env.LIGHTDASH_TOOLS_AUDIT_LOG);

const program = new Command();

program
  .name('lightdash-ai')
  .description('CLI for Lightdash AI')
  .version('0.10.0')
  .option(
    '--safety-mode <mode>',
    'Safety mode (read-only, write-idempotent, write-destructive)',
    'read-only',
  )
  .option(
    '--projects <uuids>',
    'Comma-separated list of allowed project UUIDs (security guardrail)',
  )
  .option(
    '--dry-run',
    'Simulate mutating operations without executing (env: LIGHTDASH_TOOLS_DRY_RUN=1)',
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
registerAgentopsCommand(program);
registerAgentsCommand(program);
registerGroupsCommand(program);
registerUsersCommand(program);
registerQueryCommand(program);
registerExploresCommand(program);
registerMetricsCommand(program);
registerSchedulersCommand(program);
registerTagsCommand(program);
registerContentCommand(program);
registerSchemaCommand(program);

// Parse command line arguments
program.parse(process.argv);
