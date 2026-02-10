/**
 * Logging utilities. Optional logger can be passed in client config.
 */

import type { Logger } from '../config';

/** No-op logger for when logging is disabled. */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Console-based logger. */
export const consoleLogger: Logger = {
  debug: (...args) => console.debug('[Lightdash]', ...args),
  info: (...args) => console.info('[Lightdash]', ...args),
  warn: (...args) => console.warn('[Lightdash]', ...args),
  error: (...args) => console.error('[Lightdash]', ...args),
};
