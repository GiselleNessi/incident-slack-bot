import type { WebClient } from "@slack/web-api";
import { interpretIncidentMessage } from "./claude";
import { getActiveIncidents } from "./incident-tracker";
import { fetchThreadMessages } from "../utils/thread";

const REMINDER_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the auto-reminder loop. Every 15 minutes, checks each active
 * incident thread for new activity and posts a suggested status update
 * with Approve/Dismiss buttons.
 */
export function startAutoReminders(client: WebClient): void {
  if (intervalId) {
    console.log("[AutoReminders] Already running, skipping start.");
    return;
  }

  console.log(
    `[AutoReminders] Started — checking every ${REMINDER_INTERVAL_MS / 60000} minutes.`,
  );

  intervalId = setInterval(() => {
    void checkActiveIncidents(client);
  }, REMINDER_INTERVAL_MS);
}

export function stopAutoReminders(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[AutoReminders] Stopped.");
  }
}

async function checkActiveIncidents(client: WebClient): Promise<void> {
  const incidents = getActiveIncidents();

  if (incidents.length === 0) {
    return;
  }

  console.log(
    `[AutoReminders] Checking ${incidents.length} active incident(s)...`,
  );

  for (const incident of incidents) {
    try {
      const threadMessages = await fetchThreadMessages(
        client,
        incident.channel,
        incident.threadTs,
      );

      if (threadMessages.length === 0) continue;

      const interpretation = await interpretIncidentMessage(
        "",
        threadMessages,
      );

      // If Claude thinks it's resolved, note it in the reminder
      if (interpretation.status === "resolved") {
        await client.chat.postMessage({
          channel: incident.channel,
          thread_ts: incident.threadTs,
          text: [
            `\u23f0 *Auto-Reminder — "${incident.title}"*`,
            "",
            "It looks like this incident may be resolved based on the latest thread activity.",
            "",
            `*Suggested Status:* ${interpretation.status}`,
            `*Summary:* ${interpretation.summary}`,
          ].join("\n"),
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `\u23f0 *Auto-Reminder — "${incident.title}"*`,
                  "",
                  "It looks like this incident may be resolved based on the latest thread activity.",
                  "",
                  `*Suggested Status:* ${interpretation.status}`,
                  `*Summary:* ${interpretation.summary}`,
                ].join("\n"),
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Approve Update" },
                  style: "primary",
                  action_id: "approve_reminder",
                  value: JSON.stringify({
                    ...interpretation,
                    channel: incident.channel,
                    threadTs: incident.threadTs,
                    betterStackIncidentId: incident.betterStackIncidentId,
                    pylonIssueId: incident.pylonIssueId,
                  }),
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Dismiss" },
                  action_id: "dismiss_reminder",
                },
              ],
            },
          ],
        });
      } else {
        // Still investigating — suggest a status update
        await client.chat.postMessage({
          channel: incident.channel,
          thread_ts: incident.threadTs,
          text: [
            `\u23f0 *Auto-Reminder — "${incident.title}"*`,
            "",
            "This incident is still active. Here\u2019s a suggested status update based on the latest thread activity:",
            "",
            `*Status:* ${interpretation.status}`,
            `*Summary:* ${interpretation.summary}`,
            `*Affected Chains:* ${interpretation.affected_chains.join(", ") || "None detected"}`,
          ].join("\n"),
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `\u23f0 *Auto-Reminder — "${incident.title}"*`,
                  "",
                  "This incident is still active. Here\u2019s a suggested status update based on the latest thread activity:",
                  "",
                  `*Status:* ${interpretation.status}`,
                  `*Summary:* ${interpretation.summary}`,
                  `*Affected Chains:* ${interpretation.affected_chains.join(", ") || "None detected"}`,
                ].join("\n"),
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Approve Update" },
                  style: "primary",
                  action_id: "approve_reminder",
                  value: JSON.stringify({
                    ...interpretation,
                    channel: incident.channel,
                    threadTs: incident.threadTs,
                    betterStackIncidentId: incident.betterStackIncidentId,
                    pylonIssueId: incident.pylonIssueId,
                  }),
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "Dismiss" },
                  action_id: "dismiss_reminder",
                },
              ],
            },
          ],
        });
      }
    } catch (error) {
      console.error(
        `[AutoReminders] Error checking incident "${incident.title}":`,
        error,
      );
    }
  }
}
