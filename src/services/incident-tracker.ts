/**
 * In-memory tracker for active (unresolved) incidents.
 * Used by the auto-reminder system to know which threads to check.
 */

export type ActiveIncident = {
  channel: string;
  threadTs: string;
  title: string;
  betterStackIncidentId: string;
  pylonIssueId?: string;
  startedAt: number;
};

const activeIncidents = new Map<string, ActiveIncident>();

/** Unique key for an incident based on channel + thread */
function key(channel: string, threadTs: string): string {
  return `${channel}:${threadTs}`;
}

export function trackIncident(incident: ActiveIncident): void {
  const k = key(incident.channel, incident.threadTs);
  activeIncidents.set(k, incident);
  console.log(
    `[IncidentTracker] Now tracking "${incident.title}" (${k}). Active: ${activeIncidents.size}`,
  );
}

export function resolveIncident(channel: string, threadTs: string): void {
  const k = key(channel, threadTs);
  const removed = activeIncidents.delete(k);
  if (removed) {
    console.log(
      `[IncidentTracker] Resolved incident (${k}). Active: ${activeIncidents.size}`,
    );
  }
}

export function getActiveIncidents(): ActiveIncident[] {
  return Array.from(activeIncidents.values());
}

export function getIncident(
  channel: string,
  threadTs: string,
): ActiveIncident | undefined {
  return activeIncidents.get(key(channel, threadTs));
}

export function isTracked(channel: string, threadTs: string): boolean {
  return activeIncidents.has(key(channel, threadTs));
}

export function updateIncidentPylonId(
  channel: string,
  threadTs: string,
  pylonIssueId: string,
): void {
  const incident = activeIncidents.get(key(channel, threadTs));
  if (incident) {
    incident.pylonIssueId = pylonIssueId;
  }
}
