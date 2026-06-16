export interface TokenValidationCacheEntry<T> {
  tokenHash: string;
  expiresAt: number;
  value: T;
}

const DEFAULT_MAX_SIZE = 1000;

/** Short-lived in-memory cache keyed by token hash with TTL and LRU eviction. */
export class TokenValidationCache<T> {
  private readonly entries = new Map<string, TokenValidationCacheEntry<T>>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxSize = DEFAULT_MAX_SIZE,
  ) {}

  get(tokenHash: string): T | undefined {
    const entry = this.entries.get(tokenHash);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.entries.delete(tokenHash);
      return undefined;
    }

    this.entries.delete(tokenHash);
    this.entries.set(tokenHash, entry);
    return entry.value;
  }

  set(tokenHash: string, value: T): void {
    if (this.entries.has(tokenHash)) {
      this.entries.delete(tokenHash);
    } else if (this.entries.size >= this.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(tokenHash, {
      tokenHash,
      expiresAt: Date.now() + this.ttlMs,
      value,
    });
  }

  delete(tokenHash: string): void {
    this.entries.delete(tokenHash);
  }
}
