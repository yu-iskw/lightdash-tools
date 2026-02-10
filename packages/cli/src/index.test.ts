import { describe, it, expect } from 'vitest';
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

  it('should register groups command with list and get subcommands', () => {
    const program = new Command();
    registerGroupsCommand(program);

    const groupsCmd = program.commands.find((cmd) => cmd.name() === 'groups');
    expect(groupsCmd).toBeDefined();

    const listCmd = groupsCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();

    const getCmd = groupsCmd?.commands.find((cmd) => cmd.name() === 'get');
    expect(getCmd).toBeDefined();
  });

  it('should register users list with --all option', () => {
    const program = new Command();
    registerUsersCommand(program);

    const usersCmd = program.commands.find((cmd) => cmd.name() === 'users');
    const listCmd = usersCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();

    const allOpt = listCmd?.options.find((opt) => opt.long === '--all');
    expect(allOpt).toBeDefined();
  });

  it('should register groups list with --all option', () => {
    const program = new Command();
    registerGroupsCommand(program);

    const groupsCmd = program.commands.find((cmd) => cmd.name() === 'groups');
    const listCmd = groupsCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();

    const allOpt = listCmd?.options.find((opt) => opt.long === '--all');
    expect(allOpt).toBeDefined();
  });

  it('should register users command with list and get subcommands', () => {
    const program = new Command();
    registerUsersCommand(program);

    const usersCmd = program.commands.find((cmd) => cmd.name() === 'users');
    expect(usersCmd).toBeDefined();

    const listCmd = usersCmd?.commands.find((cmd) => cmd.name() === 'list');
    expect(listCmd).toBeDefined();

    const getCmd = usersCmd?.commands.find((cmd) => cmd.name() === 'get');
    expect(getCmd).toBeDefined();
  });

  it('should register organization roles subcommands', () => {
    const program = new Command();
    registerOrganizationCommand(program);
    registerOrganizationRolesCommand(program);

    const orgCmd = program.commands.find((cmd) => cmd.name() === 'organization');
    const rolesCmd = orgCmd?.commands.find((cmd) => cmd.name() === 'roles');
    expect(rolesCmd).toBeDefined();
    expect(rolesCmd?.commands.some((c) => c.name() === 'list')).toBe(true);
    expect(rolesCmd?.commands.some((c) => c.name() === 'get')).toBe(true);
    expect(rolesCmd?.commands.some((c) => c.name() === 'assign')).toBe(true);
  });

  it('should register projects roles, access, spaces subcommands', () => {
    const program = new Command();
    registerProjectsCommand(program);
    registerProjectRoleAssignmentsCommand(program);
    registerProjectAccessCommand(program);
    registerSpacesCommand(program);

    const projectsCmd = program.commands.find((cmd) => cmd.name() === 'projects');
    expect(projectsCmd?.commands.some((c) => c.name() === 'roles')).toBe(true);
    expect(projectsCmd?.commands.some((c) => c.name() === 'access')).toBe(true);
    expect(projectsCmd?.commands.some((c) => c.name() === 'spaces')).toBe(true);
  });

  it('should register projects charts and dashboards subcommands', () => {
    const program = new Command();
    registerProjectsCommand(program);
    registerChartsCommand(program);
    registerDashboardsCommand(program);

    const projectsCmd = program.commands.find((cmd) => cmd.name() === 'projects');
    expect(projectsCmd?.commands.some((c) => c.name() === 'charts')).toBe(true);
    expect(projectsCmd?.commands.some((c) => c.name() === 'dashboards')).toBe(true);
  });

  it('should register ai-agents command with list, threads, settings', () => {
    const program = new Command();
    registerAiAgentsCommand(program);

    const aiAgentsCmd = program.commands.find((cmd) => cmd.name() === 'ai-agents');
    expect(aiAgentsCmd).toBeDefined();
    expect(aiAgentsCmd?.commands.some((c) => c.name() === 'list')).toBe(true);
    expect(aiAgentsCmd?.commands.some((c) => c.name() === 'threads')).toBe(true);
    expect(aiAgentsCmd?.commands.some((c) => c.name() === 'settings')).toBe(true);
  });

  it('should register all commands on a program', () => {
    const program = new Command();
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

    expect(program.commands).toHaveLength(5);
    expect(program.commands.map((cmd) => cmd.name()).sort()).toEqual([
      'ai-agents',
      'groups',
      'organization',
      'projects',
      'users',
    ]);
  });
});
