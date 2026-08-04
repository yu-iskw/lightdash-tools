import { describe, expect, it } from 'vitest';

import { defineTool, defineToolVariant } from './types.js';

describe('defineTool', () => {
  it('throws when registering a duplicate tool id', async () => {
    // Load one real ToolModule so `list_projects` is already defined.
    await import('./project/projects.js');
    expect(() => defineTool('list_projects', () => undefined)).toThrow(
      /Duplicate MCP tool id 'list_projects'/,
    );
  });

  it('allows intentional same-id variants after defineToolVariant', async () => {
    await import('./project/projects.js');
    expect(() => defineTool('get_project', () => undefined)).toThrow(
      /Duplicate MCP tool id 'get_project'/,
    );
    // Additional variants of an already-variant id are allowed.
    expect(() => defineToolVariant('get_project', () => undefined)).not.toThrow();
  });
});
