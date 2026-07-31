export interface WwwAuthenticateParams {
  resourceMetadataUrl: string;
  scope?: string;
  error?: string;
  errorDescription?: string;
}

function escapeQuotedString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quotedField(name: string, value: string): string {
  return `${name}="${escapeQuotedString(value)}"`;
}

/** Builds a WWW-Authenticate Bearer challenge header value. */
export function buildWwwAuthenticateHeader(params: WwwAuthenticateParams): string {
  const parts = ['Bearer'];
  const fields: string[] = [quotedField('resource_metadata', params.resourceMetadataUrl)];

  if (params.scope) {
    fields.push(quotedField('scope', params.scope));
  }
  if (params.error) {
    fields.push(quotedField('error', params.error));
  }
  if (params.errorDescription) {
    fields.push(quotedField('error_description', params.errorDescription));
  }

  return `${parts.join(' ')} ${fields.join(', ')}`;
}
