/**
 * A wrapper for sensitive strings that prevents accidental exposure in logs,
 * console output, or JSON serialization.
 */
export class SecretString {
  constructor(private readonly value: string) {}

  /**
   * Prevents the actual value from being shown when converted to a string.
   */
  toString(): string {
    return '**********';
  }

  /**
   * Prevents the actual value from being shown when serialized to JSON.
   */
  toJSON(): string {
    return '**********';
  }

  /**
   * Node.js custom inspect symbol to prevent exposure in console.log/util.inspect.
   */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return 'SecretString(**********)';
  }

  /**
   * Explicitly expose the underlying sensitive value.
   * Use this only when necessary, e.g., when setting HTTP headers.
   */
  expose(): string {
    return this.value;
  }
}
