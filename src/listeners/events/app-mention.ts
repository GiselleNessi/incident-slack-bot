import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { interpretIncidentMessage } from "../../services/claude";

export async function appMention({
  event,
  say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">): Promise<void> {
  const text = event.text ?? "";

  try {
    const interpretation = await interpretIncidentMessage(text);

    await say({
      thread_ts: event.ts,
      text: [
        "\ud83d\udcdd *Incident Draft — Please Review*",
        `*Title:* ${interpretation.incident_title}`,
        `*Status:* ${interpretation.status}`,
        `*Summary:* ${interpretation.summary}`,
      ].join("\n"),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "\ud83d\udcdd *Incident Draft — Please Review*",
              `*Title:* ${interpretation.incident_title}`,
              `*Status:* ${interpretation.status}`,
              `*Summary:* ${interpretation.summary}`,
            ].join("\n"),
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "Approve" },
              style: "primary",
              action_id: "approve_incident",
              value: JSON.stringify(interpretation),
            },
            {
              type: "button",
              text: { type: "plain_text", text: "Deny" },
              style: "danger",
              action_id: "deny_incident",
              value: JSON.stringify(interpretation),
            },
          ],
        },
      ],
    });
  } catch (error) {
    console.error("[app-mention] Error processing incident:", error);
    await say({
      text: "\u274c Failed to interpret incident message",
      thread_ts: event.ts,
    });
  }
}
