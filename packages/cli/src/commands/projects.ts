/**
 * Projects command implementation.
 */

import type { Command } from 'commander';
import { getClient } from '../utils/client';

/**
 * Registers the projects command and its subcommands.
 */
export function registerProjectsCommand(program: Command): void {
  const projectsCmd = program.command('projects').description('Manage projects');

  projectsCmd
    .command('get')
    .description('Get a project by UUID')
    .argument('<projectUuid>', 'Project UUID')
    .action(async (projectUuid: string) => {
      try {
        if (!projectUuid) {
          console.error('Error: projectUuid is required');
          process.exit(1);
        }
        const client = getClient();
        const project = await client.v1.projects.getProject(projectUuid);
        console.log(JSON.stringify(project, null, 2));
      } catch (error) {
        console.error(
          'Error fetching project:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  projectsCmd
    .command('list')
    .description('List all projects in the current organization')
    .action(async () => {
      try {
        const client = getClient();
        const projects = await client.v1.projects.listProjects();
        console.log(JSON.stringify(projects, null, 2));
      } catch (error) {
        console.error(
          'Error listing projects:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  const validateCmd = projectsCmd.command('validate').description('Project validation');

  validateCmd
    .command('run <projectUuid>')
    .description('Trigger project validation and get job ID')
    .action(async (projectUuid: string) => {
      try {
        const client = getClient();
        const result = await client.v1.validation.validateProject(projectUuid);
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error triggering validation:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });

  validateCmd
    .command('results <projectUuid>')
    .description('Get latest validation results for a project')
    .option('--job-id <id>', 'Specific validation job ID')
    .action(async (projectUuid: string, options: { jobId?: string }) => {
      try {
        const client = getClient();
        const result = await client.v1.validation.getValidationResults(projectUuid, {
          jobId: options.jobId,
        });
        console.log(JSON.stringify(result, null, 2));
      } catch (error) {
        console.error(
          'Error fetching validation results:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    });
}
