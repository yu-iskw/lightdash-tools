export {
  defineOperation,
  PROFILE_IDS,
  type AgentExposure,
  type ProfileId,
  type HttpMethod,
  type McpTaskSupport,
  type OperationAuthorization,
  type OperationCli,
  type OperationDefinitionInput,
  type OperationDescriptor,
  type OperationHttp,
  type OperationMcp,
  type SensitivityClass,
} from './types';

export { IRRECOVERABLE_TOOL_DENYLIST } from './agent-safe';

export { AI_AGENT_OPERATIONS } from './ai-agents';
export { CLI_CONTENT_OPERATIONS } from './cli-content';
export { CONTENT_DEVELOPER_OPERATIONS } from './content-developer';
export { CONTENT_GOVERNANCE_OPERATIONS } from './content-governance';
export { CONTENT_READER_OPERATIONS } from './content-reader';
export { DATA_ANALYST_OPERATIONS } from './data-analyst';
export { ORGANIZATION_AUDIT_OPERATIONS } from './organization-audit';
export { SEMANTIC_LAYER_OPERATIONS } from './semantic-layer';
export { USER_OPERATIONS } from './users';

export {
  getOperation,
  getOperationByMcpToolName,
  getOperationsByProfile,
  listBannedMcpToolNames,
  listExposedMcpToolNames,
  listMcpToolNamesByProfile,
  listOperations,
} from './registry';

export {
  OPERATION_CLIENT_METHOD_MAP,
  getClientMethodForOperation,
  type CataloguedOperationId,
  type ClientMethodRef,
} from './client-coverage';
