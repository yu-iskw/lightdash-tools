export interface WwwAuthenticateParams {
  resourceMetadataUrl: string;
  scope?: string;
  error?: string;
  errorDescription?: string;
}

/** Builds a WWW-Authenticate Bearer challenge header value. */
export function buildWwwAuthenticateHeader(params: WwwAuthenticateParams): string {
  const parts = ['Bearer'];
  const fields: string[] = [`resource_metadata="${params.resourceMetadataUrl}"`];

  if (params.scope) {
    fields.push(`scope="${params.scope}"`);
  }
  if (params.error) {
    fields.push(`error="${params.error}"`);
  }
  if (params.errorDescription) {
    fields.push(`error_description="${params.errorDescription}"`);
  }

  return `${parts.join(' ')} ${fields.join(', ')}`;
}
