/**
 * MCP tools: AI agents (admin + project-scoped), threads, and evaluations.
 */

import { registerAdminAiAgentTools } from './ai-agents/admin-tools.js';
import { registerProjectAgentEvaluationTools } from './ai-agents/evaluation-tools.js';
import { registerProjectAgentCrudTools } from './ai-agents/project-crud-tools.js';
import { registerProjectAgentThreadTools } from './ai-agents/project-thread-tools.js';

import type { McpContextProvider } from '../request-context.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAiAgentTools(server: McpServer, contextProvider: McpContextProvider): void {
  registerAdminAiAgentTools(server, contextProvider);
  registerProjectAgentCrudTools(server, contextProvider);
  registerProjectAgentThreadTools(server, contextProvider);
  registerProjectAgentEvaluationTools(server, contextProvider);
}
