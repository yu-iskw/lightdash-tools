#!/usr/bin/env node
/**
 * Validates the shared operation registry and emits a JSON snapshot.
 * Exit 0 when the registry is complete and consistent; non-zero on failure.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMMON_DIST = path.join(ROOT, 'packages/common/dist');
const OUTPUT_PATH = path.join(ROOT, 'packages/common/dist/operation-registry.json');

const REQUIRED_PROFILES = ['core-lifecycle', 'evaluations', 'conversations', 'discovery-readonly'];

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
  ];

  if (agentExposure === 'agent') {
    requiredStringFields.push(
      ['mcp.toolName', operation.mcp?.toolName],
      ['cli.commandPath', operation.cli?.commandPath],
    );
  }

  for (const [label, value] of requiredStringFields) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`Operation '${operation.id ?? '<unknown>'}' missing ${label}`);
    }
  }

  if (agentExposure === 'client-only' && operation.mcp?.taskSupport?.exposed === true) {
    errors.push(`Operation '${operation.id}' client-only must set mcp.taskSupport.exposed to false`);
  }

  if (!Array.isArray(operation.profiles) || operation.profiles.length === 0) {
    errors.push(`Operation '${operation.id}' must declare at least one profile`);
  }

  if (operation.http?.path && !operation.http.path.startsWith('/api/v1/')) {
    errors.push(`Operation '${operation.id}' http.path must start with /api/v1/`);
  }

  const impact = operation.authorization?.safetyImpact;
  const annotations = operation.mcp?.annotations;
  if (impact === 'read' && annotations?.idempotentHint !== true) {
    errors.push(`Operation '${operation.id}' read impact requires idempotentHint=true`);
  }
  if (impact === 'write-destructive' && annotations?.idempotentHint === true) {
    errors.push(`Operation '${operation.id}' destructive impact must not set idempotentHint=true`);
  }
}

async function main() {
  const errors = [];
  const { listOperations, getOperation, getOperationsByProfile } = await loadRegistry();
  const operations = listOperations();

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

  for (const profile of REQUIRED_PROFILES) {
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
      REQUIRED_PROFILES.map((profile) => [profile, getOperationsByProfile(profile).length]),
    ),
    operations: operations.map((operation) => ({
      id: operation.id,
      summary: operation.summary,
      http: operation.http,
      authorization: operation.authorization,
      mcp: {
        toolName: operation.mcp.toolName,
        annotations: operation.mcp.annotations,
        taskSupport: operation.mcp.taskSupport,
      },
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
