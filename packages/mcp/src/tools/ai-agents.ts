/**
 * MCP tools: AI agents (admin + project-scoped), threads, and evaluations.
 */

import { registerAdminAiAgentTools } from './ai-agents/admin-tools.js';
import { registerProjectAgentEvaluationTools } from './ai-agents/evaluation-tools.js';
import { registerProjectAgentCrudTools } from './ai-agents/project-crud-tools.js';
import { registerProjectAgentThreadTools } from './ai-agents/project-thread-tools.js';

import type { LightdashClient } from '@lightdash-tools/client';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerAiAgentTools(server: McpServer, client: LightdashClient): void {
  registerAdminAiAgentTools(server, client);
  registerProjectAgentCrudTools(server, client);
  registerProjectAgentThreadTools(server, client);
  registerProjectAgentEvaluationTools(server, client);
}
