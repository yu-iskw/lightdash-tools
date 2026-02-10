import { describe, it, expect } from 'vitest';
import { registerTools } from './tools';

describe('MCP tools', () => {
  it('registerTools is a function', () => {
    expect(typeof registerTools).toBe('function');
  });
});
