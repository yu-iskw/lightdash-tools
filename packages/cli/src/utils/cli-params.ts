/**
 * Build optional API params from CLI options, omitting null/undefined values.
 */
export function pickDefined<T extends Record<string, unknown>>(source: T): Partial<T> | undefined {
  const params: Partial<T> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value != null) {
      params[key as keyof T] = value as T[keyof T];
    }
  }
  return Object.keys(params).length > 0 ? params : undefined;
}
