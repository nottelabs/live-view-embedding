/** Header the page uses to hand a user-supplied Notte API key to this app's own routes. */
export const USER_KEY_HEADER = "x-notte-api-key";

/** Show only the start and end of a key, e.g. "sk-notte-837…c7f3". */
export function redactKey(key: string) {
  if (key.length <= 16) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 12)}…${key.slice(-4)}`;
}
