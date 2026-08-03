#!/usr/bin/env node
/**
 * Validates the shared operation catalog and emits a JSON snapshot.
 * Exit 0 when the catalog is complete and consistent; non-zero on failure.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMMON_DIST = path.join(ROOT, 'packages/common/dist');
const OUTPUT_PATH = path.join(ROOT, 'packages/common/dist/operation-registry.json');

const P0_OPERATION_IDS = [
  'ai-agents.admin.agents.list',
  'ai-agents.admin.settings.get',
  'ai-agents.admin.settings.update',
  'ai-agents.project.agents.list',
  'ai-agents.project.agents.get',
  'ai-agents.project.agents.create',
  'ai-agents.project.agents.update',
  'ai-agents.project.agents.delete',
  'ai-agents.project.threads.start',
  'ai-agents.project.threads.continue',
  'ai-agents.project.evaluations.list',
  'ai-agents.project.evaluations.get',
  'ai-agents.project.evaluations.create',
  'ai-agents.project.evaluations.update',
  'ai-agents.project.evaluations.append',
  'ai-agents.project.evaluations.delete',
  'ai-agents.project.evaluations.run',
  'ai-agents.project.evaluations.runs.list',
];

async function loadRegistry() {
  const indexPath = path.join(COMMON_DIST, 'operations/index.js');
  if (!fs.existsSync(indexPath)) {
    throw new Error(
      `Built common package not found at ${indexPath}. Run "pnpm --filter @lightdash-tools/common build" first.`,
    );
  }

  return import(indexPath);
}

function validateOperation(operation, errors) {
  const agentExposure = operation.agentExposure ?? 'agent';

  const requiredStringFields = [
    ['id', operation.id],
    ['summary', operation.summary],
    ['http.method', operation.http?.method],
    ['http.path', operation.http?.path],
    ['authorization.safetyImpact', operation.authorization?.safetyImpact],
    ['sensitivity', operation.sensitivity],
  ];

  if (agentExposure === 'agent') {
    if (!operation.mcp && !operation.cli) {
      errors.push(`Operation '${operation.id}' agent ops require mcp and/or cli`);
    }
    if (operation.mcp) {
      requiredStringFields.push(['mcp.toolName', operation.mcp.toolName]);
    }
    if (operation.cli) {
      requiredStringFields.push(['cli.commandPath', operation.cli.commandPath]);
    }
  }

  for (const [label, value] of requiredStringFields) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`Operation '${operation.id ?? '<unknown>'}' missing ${label}`);
    }
  }

  if (agentExposure === 'client-only') {
    if (operation.mcp !== undefined || operation.cli !== undefined) {
      errors.push(`Operation '${operation.id}' client-only must omit mcp and cli`);
    }
  }

  if (!Array.isArray(operation.profiles)) {
    errors.push(`Operation '${operation.id}' must declare a profiles array`);
  } else {
    const mcpExposed = operation.mcp?.taskSupport?.exposed === true;
    if (mcpExposed && operation.profiles.length === 0) {
      errors.push(
        `Operation '${operation.id}' must declare at least one profile when mcp.taskSupport.exposed is true`,
      );
    }
    if (!mcpExposed && operation.profiles.length > 0) {
      errors.push(
        `Operation '${operation.id}' must use empty profiles when not MCP-exposed (got ${operation.profiles.join(', ')})`,
      );
    }
  }

  if (operation.http?.path) {
    const opPath = operation.http.path;
    if (!opPath.startsWith('/api/v1/') && !opPath.startsWith('/api/v2/')) {
      errors.push(`Operation '${operation.id}' http.path must start with /api/v1/ or /api/v2/`);
    }
  }

  const impact = operation.authorization?.safetyImpact;
  const annotations = operation.mcp?.annotations;
  if (annotations) {
    if (impact === 'write-destructive' && annotations.idempotentHint === true) {
      errors.push(
        `Operation '${operation.id}' destructive impact must not set idempotentHint=true`,
      );
    }
  }
}

async function main() {
  const errors = [];
  const { listOperations, getOperation, getOperationsByProfile, PROFILE_IDS } =
    await loadRegistry();
  const operations = listOperations();
  const requiredProfiles = [...PROFILE_IDS];

  if (operations.length === 0) {
    errors.push('Registry is empty');
  }

  const ids = new Set();
  for (const operation of operations) {
    if (ids.has(operation.id)) {
      errors.push(`Duplicate operation id '${operation.id}'`);
    }
    ids.add(operation.id);
    validateOperation(operation, errors);
  }

  for (const id of P0_OPERATION_IDS) {
    if (!getOperation(id)) {
      errors.push(`Missing P0 operation '${id}'`);
    }
  }

  // Every serving profile must have at least one catalog operation.
  for (const profile of requiredProfiles) {
    if (getOperationsByProfile(profile).length === 0) {
      errors.push(`No operations registered for profile '${profile}'`);
    }
  }

  if (errors.length > 0) {
    for (const message of errors) {
      process.stderr.write(`${message}\n`);
    }
    process.exit(1);
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    operationCount: operations.length,
    profiles: Object.fromEntries(
      requiredProfiles.map((profile) => [profile, getOperationsByProfile(profile).length]),
    ),
    operations: operations.map((operation) => ({
      id: operation.id,
      summary: operation.summary,
      http: operation.http,
      authorization: operation.authorization,
      sensitivity: operation.sensitivity,
      agentExposure: operation.agentExposure,
      bannedMcpToolName: operation.bannedMcpToolName,
      mcp: operation.mcp
        ? {
            toolName: operation.mcp.toolName,
            annotations: operation.mcp.annotations,
            taskSupport: operation.mcp.taskSupport,
          }
        : undefined,
      cli: operation.cli,
      profiles: operation.profiles,
    })),
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
  process.stdout.write(
    `Validated ${operations.length} operations; wrote ${path.relative(ROOT, OUTPUT_PATH)}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
