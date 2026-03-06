/**
 * Tracks threads where the bot asked for chain clarification.
 * When a user replies with chain info, the message listener
 * picks it up and re-generates the incident draft.
 *
 * Includes a 10-minute cooldown to avoid spamming Claude on
 * every message in an active thread.
 */

const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

/** Stores the timestamp of the last check for each pending thread. */
const pendingThreads = new Map<string, number>();

function key(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

export function markPendingChains(channel: string, threadTs: string): void {
  pendingThreads.set(key(channel, threadTs), 0);
}

export function isPendingChains(channel: string, threadTs: string): boolean {
  return pendingThreads.has(key(channel, threadTs));
}

/**
 * Returns true if the cooldown has elapsed since the last check.
 * If ready, updates the last-checked timestamp automatically.
 */
export function isCooldownReady(channel: string, threadTs: string): boolean {
  const k = key(channel, threadTs);
  const lastCheck = pendingThreads.get(k);
  if (lastCheck === undefined) return false;

  const now = Date.now();
  if (now - lastCheck < COOLDOWN_MS) return false;

  pendingThreads.set(k, now);
  return true;
}

export function clearPendingChains(channel: string, threadTs: string): void {
  pendingThreads.delete(key(channel, threadTs));
}
