/**
 * Redaction helpers for MCP tool response sensitivity (ADR-0011).
 */

export type RedactedEmail = {
  email: string;
  domain: string;
  isExternalDomain: boolean;
};

/** MCP allowlisted project metadata — never includes connection secrets (not OpenAPI ProjectSummary). */
export type McpProjectSummary = {
  projectUuid: string;
  name: string;
  type?: string;
  organizationUuid?: string;
  upstreamProjectUuid?: string | null;
  createdByUserUuid?: string | null;
  createdAt?: string;
  warehouseType?: string;
  provisioningSource?: string | null;
};

/** Allowlisted project direct-access row with optional email redaction. */
export type ProjectMemberAccessSummary = {
  userUuid: string;
  projectUuid: string;
  firstName: string;
  lastName: string;
  role: string;
  roleUuid?: string;
  email: RedactedEmail | string | undefined;
};

export const CREDENTIALS_OMITTED_WARNING = {
  code: 'REDACTED' as const,
  message:
    'Connection credentials and contact overrides omitted; not available via MCP (use client/CLI)',
};

export const EMAIL_REDACTED_WARNING = {
  code: 'REDACTED' as const,
  message: 'Email addresses redacted; pass includeEmail=true to reveal',
};

export const SCHEDULER_DESTINATIONS_REDACTED_WARNING = {
  code: 'REDACTED' as const,
  message: 'Scheduler destinations redacted by default',
};

/** Warnings when emails are masked (empty when includeEmail is true). */
export function emailRedactionWarnings(includeEmail: boolean): Array<{
  code: 'REDACTED';
  message: string;
}> {
  return includeEmail ? [] : [EMAIL_REDACTED_WARNING];
}

/** Warnings when scheduler destinations are masked. */
export function destinationRedactionWarnings(revealDestinations: boolean): Array<{
  code: 'REDACTED';
  message: string;
}> {
  return revealDestinations ? [] : [SCHEDULER_DESTINATIONS_REDACTED_WARNING];
}

/** Allowlisted org-member row with optional email redaction. */
export type OrgMemberSummary = {
  userUuid: string;
  organizationUuid?: string;
  firstName: string;
  lastName: string;
  email: RedactedEmail | string | undefined;
  isActive?: boolean;
  isInviteExpired?: boolean;
  role?: string;
  roleUuid?: string;
};

/** Allowlisted group row; members only when present on the API payload. */
export type GroupSummary = {
  uuid: string;
  name: string;
  organizationUuid?: string;
  createdAt?: string;
  updatedAt?: string;
  createdByUserUuid?: string | null;
  memberUuids?: string[];
  members?: Array<{
    userUuid: string;
    firstName: string;
    lastName: string;
    email: RedactedEmail | string | undefined;
  }>;
};

export type RedactedDestination = {
  destinationType: string;
  redactedDestination: string;
  domain?: string;
  isExternalDomain?: boolean;
};

const SENSITIVE_TARGET_KEYS = new Set([
  'recipient',
  'channel',
  'email',
  'value',
  'webhook',
  'googleChatWebhook',
  'slackChannelName',
  'slackChannelId',
]);

function splitEmail(email: string): { local: string; domain: string } | undefined {
  const at = email.lastIndexOf('@');
  if (at <= 0 || at === email.length - 1) return undefined;
  return { local: email.slice(0, at), domain: email.slice(at + 1).toLowerCase() };
}

/** Redact an email to `a***@domain` form. */
export function redactEmail(email: string, allowedDomains?: string[]): RedactedEmail {
  const parts = splitEmail(email);
  if (!parts) {
    return { email: '***', domain: 'unknown', isExternalDomain: true };
  }
  const local = parts.local;
  const maskedLocal = local.length <= 1 ? '*' : `${local[0]}***`;
  const allowed = new Set((allowedDomains ?? []).map((d) => d.toLowerCase()));
  const isExternalDomain = allowed.size > 0 ? !allowed.has(parts.domain) : false;
  return {
    email: `${maskedLocal}@${parts.domain}`,
    domain: parts.domain,
    isExternalDomain,
  };
}

/** Optionally keep full email when includeEmail is true. */
export function maybeRedactEmail(
  email: string | null | undefined,
  includeEmail: boolean,
  allowedDomains?: string[],
): RedactedEmail | string | undefined {
  if (email == null || email === '') return undefined;
  if (includeEmail) return email;
  return redactEmail(email, allowedDomains);
}

type DestinationField = {
  key: string;
  destinationType: string | ((target: Record<string, unknown>) => string);
};

const DESTINATION_FIELDS: DestinationField[] = [
  { key: 'webhook', destinationType: 'ms_teams_webhook' },
  { key: 'googleChatWebhook', destinationType: 'google_chat_webhook' },
  {
    key: 'channel',
    destinationType: (target) => String(target.type ?? 'slack_channel'),
  },
  {
    key: 'recipient',
    destinationType: (target) => String(target.type ?? 'email'),
  },
  { key: 'email', destinationType: 'email' },
  {
    key: 'value',
    destinationType: (target) => String(target.type ?? 'unknown'),
  },
];

function stringField(target: Record<string, unknown>, key: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- key from fixed DESTINATION_FIELDS
  const value = target[key];
  return typeof value === 'string' && value ? value : undefined;
}

function extractRawDestination(target: Record<string, unknown>): {
  destinationType: string;
  raw: string;
} {
  for (const field of DESTINATION_FIELDS) {
    const raw = stringField(target, field.key);
    if (!raw) continue;
    const destinationType =
      typeof field.destinationType === 'function'
        ? field.destinationType(target)
        : field.destinationType;
    return { destinationType, raw };
  }
  return { destinationType: String(target.type ?? 'unknown'), raw: '' };
}

/** Redact a scheduler destination string (email, slack, or webhook URL). */
export function redactDestination(
  destinationType: string,
  raw: string,
  allowedDomains?: string[],
): RedactedDestination {
  if (destinationType === 'email' || raw.includes('@')) {
    const redacted = redactEmail(raw, allowedDomains);
    return {
      destinationType: destinationType || 'email',
      redactedDestination: redacted.email,
      domain: redacted.domain,
      isExternalDomain: redacted.isExternalDomain,
    };
  }
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const url = new URL(raw);
      return {
        destinationType,
        redactedDestination: `${url.protocol}//${url.host}/***`,
        domain: url.host,
        isExternalDomain: true,
      };
    } catch {
      // fall through
    }
  }
  const visible = raw.length <= 4 ? '****' : `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  return {
    destinationType,
    redactedDestination: visible,
  };
}

/** Strip sensitive destination fields from a scheduler target; never spread raw secrets. */
export function sanitizeSchedulerTarget(
  target: Record<string, unknown>,
  revealDestinations: boolean,
  allowedEmailDomains?: string[],
): Record<string, unknown> {
  const { destinationType, raw } = extractRawDestination(target);
  const safe: Record<string, unknown> = { type: target.type ?? destinationType };
  if (typeof target.schedulerUuid === 'string') safe.schedulerUuid = target.schedulerUuid;
  if (typeof target.schedulerTargetUuid === 'string') {
    safe.schedulerTargetUuid = target.schedulerTargetUuid;
  }

  if (revealDestinations) {
    for (const key of SENSITIVE_TARGET_KEYS) {
      // eslint-disable-next-line security/detect-object-injection -- fixed allowlist set
      if (key in target) safe[key] = target[key];
    }
    return safe;
  }

  if (!raw) {
    return {
      ...safe,
      destinationType,
      redactedDestination: '***',
    };
  }
  return {
    ...safe,
    ...redactDestination(destinationType, raw, allowedEmailDomains),
  };
}

/** Normalize scheduler metadata with destination redaction by default. */
export function normalizeScheduler(
  raw: Record<string, unknown>,
  revealDestinations: boolean,
  allowedEmailDomains?: string[],
): Record<string, unknown> {
  const targets = Array.isArray(raw.targets) ? raw.targets : [];
  const normalizedTargets = targets.map((t) => {
    if (!t || typeof t !== 'object') return t;
    return sanitizeSchedulerTarget(
      t as Record<string, unknown>,
      revealDestinations,
      allowedEmailDomains,
    );
  });
  return {
    schedulerUuid: raw.schedulerUuid ?? raw.uuid,
    name: raw.name,
    enabled: raw.enabled,
    cron: raw.cron,
    format: raw.format,
    createdBy: raw.createdBy,
    createdByUserUuid:
      raw.createdByUserUuid ?? (typeof raw.createdBy === 'string' ? raw.createdBy : undefined),
    savedChartUuid: raw.savedChartUuid,
    dashboardUuid: raw.dashboardUuid,
    latestRun: sanitizeLatestRun(raw.latestRun),
    targets: normalizedTargets,
  };
}

/** Strip PII / opaque details from scheduler latestRun payloads. */
function sanitizeLatestRun(latestRun: unknown): Record<string, unknown> | undefined {
  if (!latestRun || typeof latestRun !== 'object') return undefined;
  const run = latestRun as Record<string, unknown>;
  return {
    runId: run.runId,
    schedulerUuid: run.schedulerUuid,
    runStatus: run.runStatus,
    status: run.status,
    scheduledTime: run.scheduledTime,
    createdAt: run.createdAt,
    createdByUserUuid: run.createdByUserUuid,
    resourceType: run.resourceType,
    resourceUuid: run.resourceUuid,
    format: run.format,
  };
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- fixed allowlist keys at call sites
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function readStringOrNull(record: Record<string, unknown>, key: string): string | null | undefined {
  // eslint-disable-next-line security/detect-object-injection -- fixed allowlist keys at call sites
  const value = record[key];
  if (value === null) return null;
  return typeof value === 'string' ? value : undefined;
}

function asEntityRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function warehouseTypeFrom(record: Record<string, unknown>): string | undefined {
  const direct = readString(record, 'warehouseType');
  if (direct !== undefined) return direct;
  return readString(asEntityRecord(record.warehouseConnection), 'type');
}

/**
 * Shape project / organization-project payloads to metadata only.
 * Never returns warehouseConnection, dbtConnection, or schedulerFailureContactOverride.
 */
export function toProjectSummary(project: unknown): McpProjectSummary {
  const record = asEntityRecord(project);
  const type = readString(record, 'type');
  const organizationUuid = readString(record, 'organizationUuid');
  const upstreamProjectUuid = readStringOrNull(record, 'upstreamProjectUuid');
  const createdByUserUuid = readStringOrNull(record, 'createdByUserUuid');
  const createdAt = readString(record, 'createdAt');
  const warehouseType = warehouseTypeFrom(record);
  const provisioningSource = readStringOrNull(record, 'provisioningSource');

  return {
    projectUuid: readString(record, 'projectUuid') ?? '',
    name: readString(record, 'name') ?? '',
    ...(type !== undefined ? { type } : {}),
    ...(organizationUuid !== undefined ? { organizationUuid } : {}),
    ...(upstreamProjectUuid !== undefined ? { upstreamProjectUuid } : {}),
    ...(createdByUserUuid !== undefined ? { createdByUserUuid } : {}),
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(warehouseType !== undefined ? { warehouseType } : {}),
    ...(provisioningSource !== undefined ? { provisioningSource } : {}),
  };
}

/** Map a project member profile with default email redaction. */
export function toProjectMemberAccessSummary(
  member: unknown,
  includeEmail: boolean,
  allowedEmailDomains?: string[],
): ProjectMemberAccessSummary {
  const record = asEntityRecord(member);
  const roleUuid = readString(record, 'roleUuid');
  return {
    userUuid: readString(record, 'userUuid') ?? '',
    projectUuid: readString(record, 'projectUuid') ?? '',
    firstName: readString(record, 'firstName') ?? '',
    lastName: readString(record, 'lastName') ?? '',
    role: readString(record, 'role') ?? '',
    email: maybeRedactEmail(readString(record, 'email'), includeEmail, allowedEmailDomains),
    ...(roleUuid !== undefined ? { roleUuid } : {}),
  };
}

/** Map an organization member with default email redaction. */
export function toOrgMemberSummary(
  member: unknown,
  includeEmail: boolean,
  allowedEmailDomains?: string[],
): OrgMemberSummary {
  const record = asEntityRecord(member);
  return {
    userUuid: readString(record, 'userUuid') ?? '',
    organizationUuid: readString(record, 'organizationUuid'),
    firstName: readString(record, 'firstName') ?? '',
    lastName: readString(record, 'lastName') ?? '',
    email: maybeRedactEmail(readString(record, 'email'), includeEmail, allowedEmailDomains),
    isActive: typeof record.isActive === 'boolean' ? record.isActive : undefined,
    isInviteExpired:
      typeof record.isInviteExpired === 'boolean' ? record.isInviteExpired : undefined,
    role: readString(record, 'role'),
    roleUuid: readString(record, 'roleUuid'),
  };
}

/** Allowlist group metadata; redact member emails when members are present. */
export function toGroupSummary(
  group: unknown,
  includeEmail: boolean,
  allowedEmailDomains?: string[],
): GroupSummary {
  const record = asEntityRecord(group);
  const summary: GroupSummary = {
    uuid: readString(record, 'uuid') ?? '',
    name: readString(record, 'name') ?? '',
    organizationUuid: readString(record, 'organizationUuid'),
    createdAt: readString(record, 'createdAt'),
    updatedAt: readString(record, 'updatedAt'),
    createdByUserUuid: readStringOrNull(record, 'createdByUserUuid'),
  };

  if (Array.isArray(record.memberUuids)) {
    summary.memberUuids = record.memberUuids.filter((u): u is string => typeof u === 'string');
  }

  if (Array.isArray(record.members)) {
    summary.members = record.members.map((m) => {
      const member = asEntityRecord(m);
      return {
        userUuid: readString(member, 'userUuid') ?? '',
        firstName: readString(member, 'firstName') ?? '',
        lastName: readString(member, 'lastName') ?? '',
        email: maybeRedactEmail(readString(member, 'email'), includeEmail, allowedEmailDomains),
      };
    });
  }

  return summary;
}
