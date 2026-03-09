/**
 * Projects command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT, WRITE_IDEMPOTENT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the projects command and its subcommands.
 */
export function registerProjectsCommand(program: Command): void {
  const projectsCmd = program.command('projects').description('Manage projects');

  projectsCmd
    .command('get')
    .description('Get a project by UUID')
    .argument('<projectUuid>', 'Project UUID')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async (projectUuid: string) => {
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
      }),
    );

  projectsCmd
    .command('list')
    .description('List all projects in the current organization')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async () => {
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
      }),
    );

  const validateCmd = projectsCmd.command('validate').description('Project validation');

  validateCmd
    .command('run <projectUuid>')
    .description('Trigger project validation and get job ID')
    .action(
      wrapAction(WRITE_IDEMPOTENT, async (projectUuid: string) => {
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
      }),
    );

  validateCmd
    .command('results <projectUuid>')
    .description('Get validation results for a project (v2 API, paginated)')
    .option('--validation-id <id>', 'Specific validation result ID (number)')
    .option('--page <number>', 'Page number (1-indexed)', (v) => parseInt(v, 10))
    .option('--page-size <number>', 'Results per page', (v) => parseInt(v, 10))
    .action(
      wrapAction(
        READ_ONLY_DEFAULT,
        async (
          projectUuid: string,
          options: { validationId?: string; page?: number; pageSize?: number },
        ) => {
          try {
            const client = getClient();
            if (options.validationId) {
              // Get specific validation result by ID
              const validationId = parseInt(options.validationId, 10);
              if (isNaN(validationId)) {
                console.error('Error: validation-id must be a number');
                process.exit(1);
              }
              const result = await client.v2.validation.getValidationResult(
                projectUuid,
                validationId,
              );
              console.log(JSON.stringify(result, null, 2));
            } else {
              // List validation results (first page by default)
              const result = await client.v2.validation.listValidationResults(projectUuid, {
                page: options.page,
                pageSize: options.pageSize,
              });
              console.log(JSON.stringify(result, null, 2));
            }
          } catch (error) {
            console.error(
              'Error fetching validation results:',
              error instanceof Error ? error.message : String(error),
            );
            process.exit(1);
          }
        },
      ),
    );
}
