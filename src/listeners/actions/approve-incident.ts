import type { AllMiddlewareArgs, SlackActionMiddlewareArgs } from "@slack/bolt";
import type { AxiosError } from "axios";
import type { IncidentInterpretation } from "../../services/claude";
import {
  findOrCreateIncident,
  findOrCreateStatusReport,
  getStatusPageUrl,
  postIncidentUpdate,
  postStatusPageUpdate,
  updateIncidentStatus,
} from "../../services/betterstack";

export async function approveIncident({
  ack,
  action,
  respond,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs): Promise<void> {
  await ack();

  const value = "value" in action ? String(action.value) : "{}";
  const interpretation: IncidentInterpretation = JSON.parse(value);

  try {
    const incident = await findOrCreateIncident(
      interpretation.incident_title,
      interpretation.summary,
    );

    await postIncidentUpdate(incident.id, interpretation.summary);
    await updateIncidentStatus(incident.id, interpretation.status);

    const resultLines = [
      "\u2705 *Incident Approved & Created*",
      `*Title:* ${interpretation.incident_title}`,
      `*Status:* ${interpretation.status}`,
      `*Summary:* ${interpretation.summary}`,
    ];

    if (
      interpretation.affected_chains &&
      interpretation.affected_chains.length > 0
    ) {
      resultLines.push(
        `*Affected Chains:* ${interpretation.affected_chains.join(", ")}`,
      );
    }

    if (process.env.BETTERSTACK_STATUS_PAGE_ID) {
      const { report, created } = await findOrCreateStatusReport(
        interpretation.incident_title,
        interpretation.summary,
        interpretation.status,
      );

      if (!created) {
        await postStatusPageUpdate(
          report.id,
          interpretation.summary,
          interpretation.status,
        );
      }

      const statusPageUrl = await getStatusPageUrl();
      if (statusPageUrl) {
        resultLines.push("");
        resultLines.push(`\ud83d\udd17 <${statusPageUrl}|View Status Page>`);
      }
    }

    await respond({
      replace_original: true,
      text: resultLines.join("\n"),
    });
  } catch (error) {
    const axiosError = error as AxiosError;
    if (axiosError.response) {
      console.error(
        "[approve-incident] API error:",
        axiosError.response.status,
        JSON.stringify(axiosError.response.data),
      );
    } else {
      console.error("[approve-incident] Error creating incident:", error);
    }
    await respond({
      replace_original: false,
      text: "\u274c Failed to create/update incident in Better Stack",
    });
  }
}
