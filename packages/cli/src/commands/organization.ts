/**
 * Organization command implementation.
 */

import type { Command } from 'commander';
import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';
import { getClient } from '../utils/client';
import { wrapAction } from '../utils/safety';

/**
 * Registers the organization command and its subcommands.
 */
export function registerOrganizationCommand(program: Command): void {
  const orgCmd = program.command('organization').description('Manage organization');

  orgCmd
    .command('get')
    .description('Get current organization')
    .action(
      wrapAction(READ_ONLY_DEFAULT, async () => {
        try {
          const client = getClient();
          const org = await client.v1.organizations.getCurrentOrganization();
          console.log(JSON.stringify(org, null, 2));
        } catch (error) {
          console.error(
            'Error fetching organization:',
            error instanceof Error ? error.message : String(error),
          );
          process.exit(1);
        }
      }),
    );
}
