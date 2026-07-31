/**
 * Shared registration helper for organization-audit tools.
 */

import { READ_ONLY_DEFAULT } from '@lightdash-tools/common';

import { registerToolSafe } from '../shared.js';

import { assertOrganizationAuditToolSafe } from './assert-safe.js';

import type { ToolHandler, ToolOptions } from '../shared.js';
import type { McpServer } from '@modelcontextprotocol/server';

/** Register a GET read-only org-audit tool after safety asserts. */
export function registerOrgAuditTool(
  server: McpServer,
  shortName: string,
  options: Omit<ToolOptions, 'annotations'> & { annotations?: ToolOptions['annotations'] },
  handler: ToolHandler,
): void {
  const annotations = options.annotations ?? READ_ONLY_DEFAULT;
  assertOrganizationAuditToolSafe({
    shortName,
    annotations,
    httpMethod: 'GET',
  });
  registerToolSafe(server, shortName, { ...options, annotations }, handler);
}
