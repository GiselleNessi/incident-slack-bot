import type { AllMiddlewareArgs, SlackActionMiddlewareArgs } from "@slack/bolt";
import type { AxiosError } from "axios";
import {
  getStatusPageUrl,
  postIncidentUpdate,
  postStatusPageUpdate,
  findOrCreateStatusReport,
  updateIncidentStatus,
} from "../../services/betterstack";
import { resolveIncident } from "../../services/incident-tracker";
import {
  isPylonConfigured,
  updatePylonIssue,
} from "../../services/pylon";

type ReminderPayload = {
  incident_title: string;
  status: "investigating" | "resolved";
  summary: string;
  affected_chains: string[];
  channel: string;
  threadTs: string;
  betterStackIncidentId: string;
  pylonIssueId?: string;
};

export async function approveReminder({
  ack,
  action,
  respond,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs): Promise<void> {
  await ack();

  const value = "value" in action ? String(action.value) : "{}";
  const payload: ReminderPayload = JSON.parse(value);

  try {
    await postIncidentUpdate(payload.betterStackIncidentId, payload.summary);
    await updateIncidentStatus(
      payload.betterStackIncidentId,
      payload.status,
    );

    const resultLines = [
      "\u2705 *Status Update Published*",
      `*Status:* ${payload.status}`,
      `*Summary:* ${payload.summary}`,
    ];

    if (process.env.BETTERSTACK_STATUS_PAGE_ID) {
      const { report, created } = await findOrCreateStatusReport(
        payload.incident_title,
        payload.summary,
        payload.status,
      );

      if (!created) {
        await postStatusPageUpdate(
          report.id,
          payload.summary,
          payload.status,
        );
      }

      const statusPageUrl = await getStatusPageUrl();
      if (statusPageUrl) {
        resultLines.push("");
        resultLines.push(`\ud83d\udd17 <${statusPageUrl}|View Status Page>`);
      }
    }

    // Update Pylon issue status if configured
    if (isPylonConfigured() && payload.pylonIssueId) {
      try {
        await updatePylonIssue(payload.pylonIssueId, payload.status);
        resultLines.push("");
        resultLines.push(
          `\ud83d\udce8 Pylon issue updated (${payload.pylonIssueId})`,
        );
      } catch (pylonError) {
        console.error("[approve-reminder] Pylon error:", pylonError);
      }
    }

    // If resolved, stop tracking this incident
    if (payload.status === "resolved") {
      resolveIncident(payload.channel, payload.threadTs);
      resultLines.push("");
      resultLines.push(
        "_Incident marked as resolved. Auto-reminders will stop for this thread._",
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
        "[approve-reminder] API error:",
        axiosError.response.status,
        JSON.stringify(axiosError.response.data),
      );
    } else {
      console.error("[approve-reminder] Error posting update:", error);
    }
    await respond({
      replace_original: false,
      text: "\u274c Failed to publish status update to Better Stack",
    });
  }
}
