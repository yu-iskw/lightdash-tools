export interface TokenValidationCacheEntry<T> {
  tokenHash: string;
  expiresAt: number;
  value: T;
}

/** Short-lived in-memory cache keyed by token hash. */
export class TokenValidationCache<T> {
  private readonly entries = new Map<string, TokenValidationCacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(tokenHash: string): T | undefined {
    const entry = this.entries.get(tokenHash);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(tokenHash);
      return undefined;
    }
    return entry.value;
  }

  set(tokenHash: string, value: T): void {
    this.entries.set(tokenHash, {
      tokenHash,
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }
}
