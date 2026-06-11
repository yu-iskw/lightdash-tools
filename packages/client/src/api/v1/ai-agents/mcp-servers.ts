/**
 * AI agent MCP server client (EE-guarded upstream).
 * Endpoints: /api/v1/projects/{projectUuid}/aiAgents/mcpServers/...
 */

import { BaseApiClient } from '../../base-client';

import type {
  AiAgentMcpServerTool,
  AiMcpServer,
  AiMcpServerTool,
  CreateProjectMcpServerBody,
  UpdateAgentMcpServerToolsBody,
} from '@lightdash-tools/common';

export class AiAgentsMcpServersClient extends BaseApiClient {
  /** List MCP servers configured for a project (GET …/mcpServers). */
  async listProjectMcpServers(projectUuid: string): Promise<AiMcpServer[]> {
    return this.http.get<AiMcpServer[]>(`/projects/${projectUuid}/aiAgents/mcpServers`);
  }

  /** Create a project MCP server (POST …/mcpServers). */
  async createProjectMcpServer(
    projectUuid: string,
    body: CreateProjectMcpServerBody,
  ): Promise<AiMcpServer> {
    return this.http.post<AiMcpServer>(`/projects/${projectUuid}/aiAgents/mcpServers`, body);
  }

  /** List tools exposed by a project MCP server (GET …/mcpServers/{mcpServerUuid}/tools). */
  async listMcpServerTools(projectUuid: string, mcpServerUuid: string): Promise<AiMcpServerTool[]> {
    return this.http.get<AiMcpServerTool[]>(
      `/projects/${projectUuid}/aiAgents/mcpServers/${mcpServerUuid}/tools`,
    );
  }

  /** Refresh tools from the remote MCP server (POST …/tools/refresh). */
  async refreshMcpServerTools(
    projectUuid: string,
    mcpServerUuid: string,
  ): Promise<AiMcpServerTool[]> {
    return this.http.post<AiMcpServerTool[]>(
      `/projects/${projectUuid}/aiAgents/mcpServers/${mcpServerUuid}/tools/refresh`,
      {},
    );
  }

  /** List MCP servers linked to an agent (GET …/{agentUuid}/mcpServers). */
  async listAgentMcpServers(projectUuid: string, agentUuid: string): Promise<AiMcpServer[]> {
    return this.http.get<AiMcpServer[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/mcpServers`,
    );
  }

  /** Update per-agent tool enablement (PATCH …/{agentUuid}/mcpServers/{mcpServerUuid}/tools). */
  async updateAgentMcpServerTools(
    projectUuid: string,
    agentUuid: string,
    mcpServerUuid: string,
    body: UpdateAgentMcpServerToolsBody,
  ): Promise<AiAgentMcpServerTool[]> {
    return this.http.patch<AiAgentMcpServerTool[]>(
      `/projects/${projectUuid}/aiAgents/${agentUuid}/mcpServers/${mcpServerUuid}/tools`,
      body,
    );
  }
}
