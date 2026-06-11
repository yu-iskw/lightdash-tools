/**
 * Logging utilities. Optional logger can be passed in client config.
 */

import type { Logger } from '../config';

const LOG_PREFIX = '[Lightdash]';

/** No-op logger for when logging is disabled. */
export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Console-based logger. */
export const consoleLogger: Logger = {
  debug: (...args) => console.debug(LOG_PREFIX, ...args),
  info: (...args) => console.info(LOG_PREFIX, ...args),
  warn: (...args) => console.warn(LOG_PREFIX, ...args),
  error: (...args) => console.error(LOG_PREFIX, ...args),
};
