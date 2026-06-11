export {
  defineOperation,
  type CapabilityProfile,
  type HttpMethod,
  type McpTaskSupport,
  type OperationAuthorization,
  type OperationCli,
  type OperationDescriptor,
  type OperationHttp,
  type OperationMcp,
} from './types';

export { AI_AGENT_OPERATIONS } from './ai-agents';

export { getOperation, getOperationsByProfile, listOperations } from './registry';
