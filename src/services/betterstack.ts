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

export type StatusPageReport = {
  id: string;
  title: string;
  report_type: string;
  created_at: string;
};

type ResourceStatus = "downtime" | "degraded" | "resolved";

type ApiRecord = {
  id: string;
  attributes: Record<string, unknown>;
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

// ---------------------------------------------------------------------------
// Incidents (v3 API)
// ---------------------------------------------------------------------------

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

  const incidents = listResponse.data?.data as ApiRecord[] | undefined;

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

  const requesterEmail = process.env.BETTERSTACK_REQUESTER_EMAIL;
  if (!requesterEmail) {
    throw new Error(
      "BETTERSTACK_REQUESTER_EMAIL environment variable is not set",
    );
  }

  const createResponse = await client.post("/incidents", {
    requester_email: requesterEmail,
    name: title,
    summary,
    description: summary,
  });

  const created = createResponse.data?.data as ApiRecord;
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

// ---------------------------------------------------------------------------
// Status Page Reports (v2 API)
// ---------------------------------------------------------------------------

/**
 * Fetches all resource IDs for the configured status page.
 * These are needed when marking resources as affected in a report.
 */
async function getStatusPageResourceIds(): Promise<string[]> {
  const statusPageId = process.env.BETTERSTACK_STATUS_PAGE_ID;
  if (!statusPageId) return [];

  const client = createClient(BASE_URL_V2);
  const response = await client.get(
    `/status-pages/${statusPageId}/resources`,
  );
  const resources = response.data?.data as ApiRecord[] | undefined;
  return resources ? resources.map((r) => r.id) : [];
}

function toResourceStatus(
  status: "investigating" | "resolved",
): ResourceStatus {
  return status === "resolved" ? "resolved" : "downtime";
}

function buildAffectedResources(
  resourceIds: string[],
  status: ResourceStatus,
) {
  return resourceIds.map((id) => ({
    status_page_resource_id: id,
    status,
  }));
}

/**
 * Searches for an unresolved status page report matching the title.
 * If none found, creates a new one. Returns the report with a flag
 * indicating whether it was just created.
 */
export async function findOrCreateStatusReport(
  title: string,
  message: string,
  status: "investigating" | "resolved",
): Promise<{ report: StatusPageReport; created: boolean }> {
  const statusPageId = process.env.BETTERSTACK_STATUS_PAGE_ID;
  if (!statusPageId) {
    throw new Error(
      "BETTERSTACK_STATUS_PAGE_ID environment variable is not set",
    );
  }

  const client = createClient(BASE_URL_V2);
  const basePath = `/status-pages/${statusPageId}/status-reports`;

  // Search existing reports for a title match
  const listResponse = await client.get(basePath);
  const reports = listResponse.data?.data as ApiRecord[] | undefined;

  if (reports) {
    const titleLower = title.toLowerCase();
    const match = reports.find((r) => {
      const reportTitle = String(r.attributes?.title ?? "").toLowerCase();
      return reportTitle.includes(titleLower) || titleLower.includes(reportTitle);
    });

    if (match) {
      console.log(`[BetterStack] Found existing status report ${match.id}`);
      return { report: toStatusPageReport(match), created: false };
    }
  }

  // Create a new report with all status page resources marked affected
  const resourceIds = await getStatusPageResourceIds();
  const resourceStatus = toResourceStatus(status);

  const body: Record<string, unknown> = {
    title,
    message,
    report_type: "manual",
  };

  if (resourceIds.length > 0) {
    body.affected_resources = buildAffectedResources(
      resourceIds,
      resourceStatus,
    );
  }

  const createResponse = await client.post(basePath, body);
  const created = createResponse.data?.data as ApiRecord;
  console.log(`[BetterStack] Created status report ${created.id}`);
  return { report: toStatusPageReport(created), created: true };
}

/**
 * Posts a follow-up status update on an existing status page report.
 * Updates the resource status to reflect the current incident state.
 */
export async function postStatusPageUpdate(
  reportId: string,
  message: string,
  status: "investigating" | "resolved",
): Promise<void> {
  const statusPageId = process.env.BETTERSTACK_STATUS_PAGE_ID;
  if (!statusPageId) {
    throw new Error(
      "BETTERSTACK_STATUS_PAGE_ID environment variable is not set",
    );
  }

  const client = createClient(BASE_URL_V2);
  const resourceIds = await getStatusPageResourceIds();
  const resourceStatus = toResourceStatus(status);

  const body: Record<string, unknown> = { message };

  if (resourceIds.length > 0) {
    body.affected_resources = buildAffectedResources(
      resourceIds,
      resourceStatus,
    );
  }

  await client.post(
    `/status-pages/${statusPageId}/status-reports/${reportId}/status-updates`,
    body,
  );
  console.log(`[BetterStack] Posted status update on report ${reportId}`);
}

/**
 * Fetches the public URL of the configured status page.
 * Returns null if no status page is configured or URL cannot be retrieved.
 */
export async function getStatusPageUrl(): Promise<string | null> {
  const statusPageId = process.env.BETTERSTACK_STATUS_PAGE_ID;
  if (!statusPageId) return null;

  try {
    const client = createClient(BASE_URL_V2);
    const response = await client.get(`/status-pages/${statusPageId}`);
    const attrs = response.data?.data?.attributes;
    const subdomain = attrs?.subdomain as string | undefined;
    const customDomain = attrs?.custom_domain as string | undefined;
    if (customDomain) return `https://${customDomain}`;
    if (subdomain) return `https://${subdomain}.betteruptime.com`;
    return null;
  } catch (error) {
    console.error("[BetterStack] Failed to fetch status page URL:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIncident(raw: ApiRecord): Incident {
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

function toStatusPageReport(raw: ApiRecord): StatusPageReport {
  const attrs = raw.attributes;
  return {
    id: raw.id,
    title: String(attrs.title ?? ""),
    report_type: String(attrs.report_type ?? ""),
    created_at: String(attrs.created_at ?? ""),
  };
}
