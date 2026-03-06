import axios, { AxiosInstance } from "axios";

const BASE_URL = "https://api.usepylon.com";

export type PylonIssue = {
  id: string;
  title: string;
  state: string;
};

function createClient(): AxiosInstance {
  const apiKey = process.env.PYLON_API_TOKEN;
  if (!apiKey) {
    throw new Error("PYLON_API_TOKEN environment variable is not set");
  }
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Creates a new issue in Pylon to track a customer-facing incident.
 * The issue is created as "internal" so no customer notification is sent.
 */
export async function createPylonIssue(
  title: string,
  summary: string,
  affectedChains: string[],
): Promise<PylonIssue> {
  const client = createClient();

  const chainsText =
    affectedChains.length > 0
      ? `<p><strong>Affected Chains:</strong> ${affectedChains.join(", ")}</p>`
      : "";

  const bodyHtml = `<p>${summary}</p>${chainsText}`;

  const response = await client.post("/issues", {
    title,
    body_html: bodyHtml,
    state: "new",
    tags: ["incident"],
    destination_metadata: { type: "internal" },
  });

  const issue = response.data?.data;
  const pylonIssue: PylonIssue = {
    id: issue?.id ?? "",
    title: issue?.title ?? title,
    state: issue?.state ?? "new",
  };

  console.log(`[Pylon] Created issue ${pylonIssue.id}: "${title}"`);
  return pylonIssue;
}

/**
 * Updates a Pylon issue state when incident status changes.
 * Maps incident statuses to Pylon states:
 *   investigating → waiting_on_you
 *   resolved → closed
 */
export async function updatePylonIssue(
  issueId: string,
  status: "investigating" | "resolved",
): Promise<void> {
  const client = createClient();

  const state = status === "resolved" ? "closed" : "waiting_on_you";

  await client.patch(`/issues/${issueId}`, { state });
  console.log(`[Pylon] Updated issue ${issueId} → ${state}`);
}

/**
 * Returns true if the Pylon integration is configured (API token is set).
 */
export function isPylonConfigured(): boolean {
  return !!process.env.PYLON_API_TOKEN;
}
