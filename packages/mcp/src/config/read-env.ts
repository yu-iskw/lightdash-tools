/**
 * Read a process env value, treating empty string as unset.
 */

export function readEnv(name: string, env: NodeJS.ProcessEnv): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- env var names are fixed constants at call sites
  const value = env[name];
  if (value === undefined || value === '') return undefined;
  return value;
}
