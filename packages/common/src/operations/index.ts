export {
  defineOperation,
  type AgentExposure,
  type CapabilityProfile,
  type HttpMethod,
  type McpTaskSupport,
  type OperationAuthorization,
  type OperationCli,
  type OperationDescriptor,
  type OperationHttp,
  type OperationMcp,
} from './types';

export { IRRECOVERABLE_TOOL_DENYLIST, listBannedMcpToolNames } from './agent-safe';

export { AI_AGENT_OPERATIONS } from './ai-agents';
export { USER_OPERATIONS } from './users';

export { getOperation, getOperationsByProfile, listOperations } from './registry';
