/**
 * Redaction helpers for organization-audit tools.
 */

export type RedactedEmail = {
  email: string;
  domain: string;
  isExternalDomain: boolean;
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
