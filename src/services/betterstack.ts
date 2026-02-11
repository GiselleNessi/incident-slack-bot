import axios, { AxiosInstance } from "axios";

export type Incident = {
  id: string;
  name: string;
  url: string;
  cause: string;
  started_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

const BASE_URL_V3 = "https://uptime.betterstack.com/api/v3";
const BASE_URL_V2 = "https://uptime.betterstack.com/api/v2";

function createClient(baseURL: string): AxiosInstance {
  const apiKey = process.env.BETTERSTACK_API_KEY;
  if (!apiKey) {
    throw new Error("BETTERSTACK_API_KEY environment variable is not set");
  }
  return axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Searches for an open incident matching the given title.
 * If no match is found, creates a new incident.
 * Returns the incident object with its ID.
 */
export async function findOrCreateIncident(
  title: string,
  summary: string,
): Promise<Incident> {
  const client = createClient(BASE_URL_V3);

  const listResponse = await client.get("/incidents", {
    params: { resolved: false },
  });

  const incidents = listResponse.data?.data as
    | Array<{ id: string; attributes: Record<string, unknown> }>
    | undefined;

  if (incidents) {
    const titleLower = title.toLowerCase();
    const match = incidents.find((inc) => {
      const name = String(inc.attributes?.name ?? "").toLowerCase();
      return name.includes(titleLower) || titleLower.includes(name);
    });

    if (match) {
      console.log(`[BetterStack] Found existing incident ${match.id}`);
      return toIncident(match);
    }
  }

  const createResponse = await client.post("/incidents", {
    summary: title,
    description: summary,
  });

  const created = createResponse.data?.data as {
    id: string;
    attributes: Record<string, unknown>;
  };
  console.log(`[BetterStack] Created incident ${created.id}`);
  return toIncident(created);
}

/**
 * Updates the status of the given incident.
 * - "resolved" calls the resolve endpoint.
 * - "investigating" is the default state; no API call needed.
 */
export async function updateIncidentStatus(
  id: string,
  status: "investigating" | "resolved",
): Promise<void> {
  if (status !== "resolved") {
    return;
  }

  const client = createClient(BASE_URL_V3);
  await client.post(`/incidents/${id}/resolve`);
  console.log(`[BetterStack] Resolved incident ${id}`);
}

/**
 * Posts a comment on the incident timeline.
 * Uses the v2 comments API to add a timestamped update.
 */
export async function postIncidentUpdate(
  id: string,
  message: string,
): Promise<void> {
  const client = createClient(BASE_URL_V2);
  await client.post(`/incidents/${id}/comments`, {
    content: message,
  });
  console.log(`[BetterStack] Posted update on incident ${id}`);
}

function toIncident(raw: {
  id: string;
  attributes: Record<string, unknown>;
}): Incident {
  const attrs = raw.attributes;
  return {
    id: raw.id,
    name: String(attrs.name ?? ""),
    url: String(attrs.url ?? ""),
    cause: String(attrs.cause ?? ""),
    started_at: String(attrs.started_at ?? ""),
    acknowledged_at: attrs.acknowledged_at
      ? String(attrs.acknowledged_at)
      : null,
    resolved_at: attrs.resolved_at ? String(attrs.resolved_at) : null,
  };
}
