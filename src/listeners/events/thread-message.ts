import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import { interpretIncidentMessage } from "../../services/claude";
import {
  isPendingChains,
  isCooldownReady,
  clearPendingChains,
} from "../../services/pending-chains";
import { fetchThreadMessages } from "../../utils/thread";

/**
 * Listens for new messages in threads where the bot previously
 * asked for chain clarification. Re-interprets the thread and
 * posts an updated incident draft with Approve/Deny buttons.
 */
export async function threadMessage({
  event,
  client,
  say,
}: AllMiddlewareArgs &
  SlackEventMiddlewareArgs<"message">): Promise<void> {
  // Only care about threaded replies (not top-level messages)
  if (!("thread_ts" in event) || !event.thread_ts) return;

  // Ignore bot messages to avoid loops
  if ("bot_id" in event && event.bot_id) return;
  if ("subtype" in event && event.subtype) return;

  const channel = event.channel;
  const threadTs = event.thread_ts;

  if (!isPendingChains(channel, threadTs)) return;
  if (!isCooldownReady(channel, threadTs)) return;

  try {
    const threadMessages = await fetchThreadMessages(client, channel, threadTs);

    const interpretation = await interpretIncidentMessage("", threadMessages);

    // If chains are now detected, clear the pending state and post the updated draft
    if (interpretation.chains_confident && interpretation.affected_chains.length > 0) {
      clearPendingChains(channel, threadTs);

      await say({
        thread_ts: threadTs,
        text: [
          `\u2705 *Updated Incident Draft — Chains Detected*`,
          `*Title:* ${interpretation.incident_title}`,
          `*Status:* ${interpretation.status}`,
          `*Summary:* ${interpretation.summary}`,
          `*Affected Chains:* ${interpretation.affected_chains.join(", ")}`,
        ].join("\n"),
        blocks: [
          {
            type: "section" as const,
            text: {
              type: "mrkdwn" as const,
              text: [
                `\u2705 *Updated Incident Draft — Chains Detected*`,
                `*Title:* ${interpretation.incident_title}`,
                `*Status:* ${interpretation.status}`,
                `*Summary:* ${interpretation.summary}`,
                `*Affected Chains:* ${interpretation.affected_chains.join(", ")}`,
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
        ],
      });
    }
  } catch (error) {
    console.error("[thread-message] Error processing chain follow-up:", error);
  }
}
