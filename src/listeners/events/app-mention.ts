import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";
import type { WebClient } from "@slack/web-api";
import {
  interpretIncidentMessage,
  summarizeThread,
} from "../../services/claude";
import { markPendingChains } from "../../services/pending-chains";
import { fetchThreadMessages } from "../../utils/thread";

type SayFn = AllMiddlewareArgs &
  SlackEventMiddlewareArgs<"app_mention"> extends { say: infer S } ? S : never;

/**
 * Parses the first word after the bot mention as a command.
 * Returns the command and the remaining text.
 */
function parseCommand(text: string): { command: string; rest: string } {
  const cleaned = text.replace(/<@[A-Z0-9]+>/g, "").trim();
  const spaceIdx = cleaned.indexOf(" ");
  if (spaceIdx === -1) {
    return { command: cleaned.toLowerCase(), rest: "" };
  }
  return {
    command: cleaned.slice(0, spaceIdx).toLowerCase(),
    rest: cleaned.slice(spaceIdx + 1).trim(),
  };
}

export async function appMention({
  event,
  client,
  say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">): Promise<void> {
  const threadTs = event.thread_ts ?? event.ts;
  const { command } = parseCommand(event.text ?? "");

  try {
    switch (command) {
      case "summarize":
        await handleSummarize(client, say, event.channel, threadTs);
        return;
      case "update":
        await handleUpdate(client, say, event.channel, threadTs);
        return;
      default:
        await handleIncidentDraft(client, say, event.channel, threadTs, event.text ?? "");
        return;
    }
  } catch (error) {
    console.error(`[app-mention] Error handling "${command}":`, error);
    await say({
      text: `\u274c Failed to process \`${command || "incident"}\` command`,
      thread_ts: threadTs,
    });
  }
}

// ---------------------------------------------------------------------------
// Command: summarize
// ---------------------------------------------------------------------------

async function handleSummarize(
  webClient: WebClient,
  say: SayFn,
  channel: string,
  threadTs: string,
): Promise<void> {
  const threadMessages = await fetchThreadMessages(webClient, channel, threadTs);

  if (threadMessages.length === 0) {
    await say({
      thread_ts: threadTs,
      text: "\u26a0\ufe0f No thread messages found to summarize. Tag me inside an incident thread.",
    });
    return;
  }

  const summary = await summarizeThread(threadMessages);

  const timelineText = summary.timeline
    .map((item) => `\u2022 ${item}`)
    .join("\n");

  await say({
    thread_ts: threadTs,
    text: [
      "\ud83d\udccb *Thread Summary*",
      `*Title:* ${summary.title}`,
      `*Current Status:* ${summary.status}`,
      `*Affected Chains:* ${summary.affected_chains.join(", ") || "None detected"}`,
      "",
      "*Timeline:*",
      timelineText,
    ].join("\n"),
  });
}

// ---------------------------------------------------------------------------
// Command: update
// ---------------------------------------------------------------------------

async function handleUpdate(
  webClient: WebClient,
  say: SayFn,
  channel: string,
  threadTs: string,
): Promise<void> {
  const threadMessages = await fetchThreadMessages(webClient, channel, threadTs);

  if (threadMessages.length === 0) {
    await say({
      thread_ts: threadTs,
      text: "\u26a0\ufe0f No thread messages found. Tag me inside an incident thread to generate an update.",
    });
    return;
  }

  const interpretation = await interpretIncidentMessage("", threadMessages);

  await say({
    thread_ts: threadTs,
    text: [
      "\ud83d\udcdd *Incident Update Draft — Please Review*",
      `*Title:* ${interpretation.incident_title}`,
      `*Status:* ${interpretation.status}`,
      `*Summary:* ${interpretation.summary}`,
      `*Affected Chains:* ${interpretation.affected_chains.join(", ") || "None detected"}`,
    ].join("\n"),
    blocks: buildDraftBlocks(interpretation),
  });
}

// ---------------------------------------------------------------------------
// Default: incident draft (original behavior)
// ---------------------------------------------------------------------------

async function handleIncidentDraft(
  webClient: WebClient,
  say: SayFn,
  channel: string,
  threadTs: string,
  rawText: string,
): Promise<void> {
  const threadMessages = await fetchThreadMessages(webClient, channel, threadTs);

  const mentionText = rawText.replace(/<@[A-Z0-9]+>/g, "").trim();

  const interpretation = await interpretIncidentMessage(
    mentionText,
    threadMessages.length > 0 ? threadMessages : undefined,
  );

  if (!interpretation.chains_confident) {
    markPendingChains(channel, threadTs);

    await say({
      thread_ts: threadTs,
      text: [
        "\u26a0\ufe0f I couldn't confidently detect which chains are affected from this thread.",
        "Could someone reply with the affected chains so I can include them in the status update?",
        "",
        "_In the meantime, here\u2019s what I\u2019ve drafted:_",
        "",
        `\ud83d\udcdd *Incident Draft \u2014 Please Review*`,
        `*Title:* ${interpretation.incident_title}`,
        `*Status:* ${interpretation.status}`,
        `*Summary:* ${interpretation.summary}`,
        `*Affected Chains:* ${interpretation.affected_chains.length > 0 ? interpretation.affected_chains.join(", ") : "Unknown \u2014 please specify"}`,
      ].join("\n"),
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              "\u26a0\ufe0f I couldn't confidently detect which chains are affected from this thread.",
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
      `\ud83d\udcdd *Incident Draft \u2014 Please Review*`,
      `*Title:* ${interpretation.incident_title}`,
      `*Status:* ${interpretation.status}`,
      `*Summary:* ${interpretation.summary}`,
      `*Affected Chains:* ${interpretation.affected_chains.join(", ") || "None detected"}`,
    ].join("\n"),
    blocks: buildDraftBlocks(interpretation),
  });
}

// ---------------------------------------------------------------------------
// Shared block builder
// ---------------------------------------------------------------------------

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
          `\ud83d\udcdd *Incident Draft \u2014 Please Review*`,
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
