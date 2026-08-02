/**
 * Process-local PreviewStore with a mutex serializing compareAndSwap (ADR-0016).
 */

import type { PreviewLedgerEntry, PreviewStatus, PreviewStore } from '../policy/preview-ledger.js';

export class InMemoryPreviewStore implements PreviewStore {
  private readonly entries = new Map<string, PreviewLedgerEntry>();
  /** Promise chain mutex so CAS is atomic within the process. */
  private lock: Promise<void> = Promise.resolve();

  private async withLock<T>(fn: () => Promise<T> | T): Promise<T> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.lock;
    this.lock = previous.then(
      () => next,
      () => next,
    );
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async get(previewId: string): Promise<PreviewLedgerEntry | undefined> {
    return this.withLock(() => {
      const entry = this.entries.get(previewId);
      return entry ? structuredClone(entry) : undefined;
    });
  }

  async put(entry: PreviewLedgerEntry): Promise<void> {
    await this.withLock(() => {
      this.entries.set(entry.previewId, structuredClone(entry));
    });
  }

  async compareAndSwap(
    previewId: string,
    expectedStatus: PreviewStatus,
    next: PreviewLedgerEntry,
  ): Promise<boolean> {
    return this.withLock(() => {
      const current = this.entries.get(previewId);
      if (!current || current.status !== expectedStatus) {
        return false;
      }
      if (next.previewId !== previewId) {
        return false;
      }
      this.entries.set(previewId, structuredClone(next));
      return true;
    });
  }

  async compareAndDelete(previewId: string, expectedStatus: PreviewStatus): Promise<boolean> {
    return this.withLock(() => {
      const current = this.entries.get(previewId);
      if (!current || current.status !== expectedStatus) {
        return false;
      }
      this.entries.delete(previewId);
      return true;
    });
  }

  async delete(previewId: string): Promise<void> {
    await this.withLock(() => {
      this.entries.delete(previewId);
    });
  }

  /** Test helper. */
  clear(): void {
    this.entries.clear();
  }
}
