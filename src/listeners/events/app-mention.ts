import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { interpretIncidentMessage } from "../../services/claude";
import { fetchThreadMessages } from "../../utils/thread";

export async function appMention({
  event,
  client,
  say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">): Promise<void> {
  // Determine thread root: if the mention is inside a thread use that,
  // otherwise the mention message itself becomes the thread root.
  const threadTs = event.thread_ts ?? event.ts;

  try {
    // Fetch all thread messages for context
    const threadMessages = await fetchThreadMessages(
      client,
      event.channel,
      threadTs,
    );

    const mentionText = (event.text ?? "")
      .replace(/<@[A-Z0-9]+>/g, "")
      .trim();

    const interpretation = await interpretIncidentMessage(
      mentionText,
      threadMessages.length > 0 ? threadMessages : undefined,
    );

    // If chains aren't confidently detected, ask the thread first
    if (!interpretation.chains_confident) {
      await say({
        thread_ts: threadTs,
        text: [
          "⚠️ I couldn't confidently detect which chains are affected from this thread.",
          "Could someone reply with the affected chains so I can include them in the status update?",
          "",
          "_In the meantime, here's what I've drafted:_",
          "",
          `📝 *Incident Draft — Please Review*`,
          `*Title:* ${interpretation.incident_title}`,
          `*Status:* ${interpretation.status}`,
          `*Summary:* ${interpretation.summary}`,
          `*Affected Chains:* ${interpretation.affected_chains.length > 0 ? interpretation.affected_chains.join(", ") : "Unknown — please specify"}`,
        ].join("\n"),
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                "⚠️ I couldn't confidently detect which chains are affected from this thread.",
                "Could someone reply with the affected chains so I can include them in the status update?",
              ].join("\n"),
            },
          },
          { type: "divider" },
          ...buildDraftBlocks(interpretation),
        ],
      });
      return;
    }

    await say({
      thread_ts: threadTs,
      text: [
        `📝 *Incident Draft — Please Review*`,
        `*Title:* ${interpretation.incident_title}`,
        `*Status:* ${interpretation.status}`,
        `*Summary:* ${interpretation.summary}`,
        `*Affected Chains:* ${interpretation.affected_chains.join(", ") || "None detected"}`,
      ].join("\n"),
      blocks: buildDraftBlocks(interpretation),
    });
  } catch (error) {
    console.error("[app-mention] Error processing incident:", error);
    await say({
      text: "❌ Failed to interpret incident message",
      thread_ts: threadTs,
    });
  }
}

function buildDraftBlocks(interpretation: {
  incident_title: string;
  status: string;
  summary: string;
  affected_chains: string[];
}) {
  return [
    {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: [
          `📝 *Incident Draft — Please Review*`,
          `*Title:* ${interpretation.incident_title}`,
          `*Status:* ${interpretation.status}`,
          `*Summary:* ${interpretation.summary}`,
          `*Affected Chains:* ${interpretation.affected_chains.join(", ") || "None detected"}`,
        ].join("\n"),
      },
    },
    {
      type: "actions" as const,
      elements: [
        {
          type: "button" as const,
          text: { type: "plain_text" as const, text: "Approve" },
          style: "primary" as const,
          action_id: "approve_incident",
          value: JSON.stringify(interpretation),
        },
        {
          type: "button" as const,
          text: { type: "plain_text" as const, text: "Deny" },
          style: "danger" as const,
          action_id: "deny_incident",
          value: JSON.stringify(interpretation),
        },
      ],
    },
  ];
}
