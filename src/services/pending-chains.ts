/**
 * Tracks threads where the bot asked for chain clarification.
 * When a user replies with chain info, the message listener
 * picks it up and re-generates the incident draft.
 */

const pendingThreads = new Set<string>();

function key(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

export function markPendingChains(channel: string, threadTs: string): void {
  pendingThreads.add(key(channel, threadTs));
}

export function isPendingChains(channel: string, threadTs: string): boolean {
  return pendingThreads.has(key(channel, threadTs));
}

export function clearPendingChains(channel: string, threadTs: string): void {
  pendingThreads.delete(key(channel, threadTs));
}
