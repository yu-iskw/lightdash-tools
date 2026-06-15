export type TokenValidationFailureReason = 'invalid_token' | 'upstream_unavailable';

export class TokenValidationError extends Error {
  constructor(
    public readonly reason: TokenValidationFailureReason,
    message: string,
  ) {
    super(message);
    this.name = 'TokenValidationError';
    Object.setPrototypeOf(this, TokenValidationError.prototype);
  }
}
