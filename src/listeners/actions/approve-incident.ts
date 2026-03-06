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
import {
  trackIncident,
  resolveIncident,
  updateIncidentPylonId,
} from "../../services/incident-tracker";
import {
  createPylonIssue,
  isPylonConfigured,
} from "../../services/pylon";

export async function approveIncident({
  ack,
  action,
  body,
  respond,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs): Promise<void> {
  await ack();

  const value = "value" in action ? String(action.value) : "{}";
  const interpretation: IncidentInterpretation = JSON.parse(value);

  // Extract channel and thread from the action's message context
  const channel =
    "channel" in body && body.channel ? (body.channel as { id: string }).id : "";
  const messageTs =
    "message" in body && body.message
      ? (body.message as { thread_ts?: string; ts: string }).thread_ts ??
        (body.message as { ts: string }).ts
      : "";

  try {
    const incident = await findOrCreateIncident(
      interpretation.incident_title,
      interpretation.summary,
    );

    await postIncidentUpdate(incident.id, interpretation.summary);
    await updateIncidentStatus(incident.id, interpretation.status);

    // Track for auto-reminders (only if not resolved)
    if (interpretation.status !== "resolved" && channel && messageTs) {
      trackIncident({
        channel,
        threadTs: messageTs,
        title: interpretation.incident_title,
        betterStackIncidentId: incident.id,
        startedAt: Date.now(),
      });
    } else if (interpretation.status === "resolved" && channel && messageTs) {
      resolveIncident(channel, messageTs);
    }

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

    // Create a Pylon issue for customer tracking (optional)
    if (isPylonConfigured()) {
      try {
        const pylonIssue = await createPylonIssue(
          interpretation.incident_title,
          interpretation.summary,
          interpretation.affected_chains ?? [],
        );
        if (channel && messageTs) {
          updateIncidentPylonId(channel, messageTs, pylonIssue.id);
        }
        resultLines.push("");
        resultLines.push(
          `\ud83d\udce8 Pylon issue created (${pylonIssue.id})`,
        );
      } catch (pylonError) {
        console.error("[approve-incident] Pylon error:", pylonError);
        resultLines.push("");
        resultLines.push(
          "\u26a0\ufe0f Pylon issue creation failed — incident still tracked in Better Stack",
        );
      }
    }

    if (interpretation.status !== "resolved" && channel && messageTs) {
      resultLines.push("");
      resultLines.push(
        "_\u23f0 Auto-reminders enabled — I\u2019ll check this thread every 15 minutes for updates._",
      );
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
