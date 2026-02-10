import { describe, it, expect } from 'vitest';
import { Command } from 'commander';
import { registerOrganizationCommand } from './commands/organization';
import { registerProjectsCommand } from './commands/projects';
import { registerGroupsCommand } from './commands/groups';
import { registerUsersCommand } from './commands/users';

describe('CLI Command Registration', () => {
  it('should register organization command', () => {
    const program = new Command();
    registerOrganizationCommand(program);

    const orgCmd = program.commands.find((cmd) => cmd.name() === 'organization');
    expect(orgCmd).toBeDefined();

    const getCmd = orgCmd?.commands.find((cmd) => cmd.name() === 'get');
    expect(getCmd).toBeDefined();
  });

  it('should register projects command with get and list subcommands', () => {
    const program = new Command();
    registerProjectsCommand(program);

    const projectsCmd = program.commands.find((cmd) => cmd.name() === 'projects');
    expect(projectsCmd).toBeDefined();

    const getCmd = projectsCmd?.commands.find((cmd) => cmd.name() === 'get');
    expect(getCmd).toBeDefined();

    const listCmd = projectsCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();
  });

  it('should register groups command with list subcommand', () => {
    const program = new Command();
    registerGroupsCommand(program);

    const groupsCmd = program.commands.find((cmd) => cmd.name() === 'groups');
    expect(groupsCmd).toBeDefined();

    const listCmd = groupsCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();
  });

  it('should register users command with list subcommand', () => {
    const program = new Command();
    registerUsersCommand(program);

    const usersCmd = program.commands.find((cmd) => cmd.name() === 'users');
    expect(usersCmd).toBeDefined();

    const listCmd = usersCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();
  });

  it('should register all commands on a program', () => {
    const program = new Command();
    registerOrganizationCommand(program);
    registerProjectsCommand(program);
    registerGroupsCommand(program);
    registerUsersCommand(program);

    expect(program.commands).toHaveLength(4);
    expect(program.commands.map((cmd) => cmd.name())).toEqual([
      'organization',
      'projects',
      'groups',
      'users',
    ]);
  });
});
