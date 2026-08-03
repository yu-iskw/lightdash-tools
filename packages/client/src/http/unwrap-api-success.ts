/**
 * Pure helpers for Lightdash API success envelopes.
 * HttpClient uses `isApiSuccessEnvelope` then maps failures to `LightdashApiError`.
 */

export type ApiSuccessEnvelope<T> = {
  status: 'ok';
  results: T;
};

export type ApiErrorEnvelope = {
  status: 'error';
  error: {
    statusCode: number;
    name?: string;
    message?: string;
    [key: string]: unknown;
  };
};

export type ApiEnvelope<T> = ApiErrorEnvelope | ApiSuccessEnvelope<T>;

/** Type guard for Lightdash `{ status: 'ok', results }` responses. */
export function isApiSuccessEnvelope<T>(data: ApiEnvelope<T>): data is ApiSuccessEnvelope<T> {
  return data.status === 'ok';
}

/**
 * Unwraps a Lightdash success envelope to `results`.
 * Throws a plain `Error` when `status` is not `ok` (message from `error.message` when present).
 * Prefer `HttpClient` in production paths that need `LightdashApiError` + axios context.
 */
export function unwrapApiSuccessResults<T>(data: ApiEnvelope<T>): T {
  if (!isApiSuccessEnvelope(data)) {
    const message =
      typeof data.error?.message === 'string' ? data.error.message : 'Lightdash API error';
    throw new Error(message);
  }
  return data.results;
}
