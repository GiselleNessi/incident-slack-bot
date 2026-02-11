import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { interpretIncidentMessage } from "../../services/claude";
import {
  findOrCreateIncident,
  findOrCreateStatusReport,
  postIncidentUpdate,
  postStatusPageUpdate,
  updateIncidentStatus,
} from "../../services/betterstack";

export async function appMention({
  event,
  say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">): Promise<void> {
  const text = event.text ?? "";

  try {
    const interpretation = await interpretIncidentMessage(text);

    const incident = await findOrCreateIncident(
      interpretation.incident_title,
      interpretation.summary,
    );

    await postIncidentUpdate(incident.id, interpretation.summary);
    await updateIncidentStatus(incident.id, interpretation.status);

    // Update the public status page if configured
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
    }

    await say({
      text: [
        "\u2705 Incident created/updated",
        `*Title:* ${interpretation.incident_title}`,
        `*Status:* ${interpretation.status}`,
        `*Summary:* ${interpretation.summary}`,
      ].join("\n"),
      thread_ts: event.ts,
    });
  } catch (error) {
    console.error("[app-mention] Error processing incident:", error);
    await say({
      text: "\u274c Failed to create/update incident",
      thread_ts: event.ts,
    });
  }
}
