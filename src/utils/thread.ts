import type { WebClient } from "@slack/web-api";

/**
 * Fetches all messages in a Slack thread, oldest-first.
 * Returns the plain text of each message, stripping bot mentions.
 * If the timestamp has no replies (not a thread), returns an empty array.
 */
export async function fetchThreadMessages(
  client: WebClient,
  channel: string,
  threadTs: string,
): Promise<string[]> {
  const result = await client.conversations.replies({
    channel,
    ts: threadTs,
    limit: 100,
  });

  const messages = result.messages ?? [];

  // Filter out empty messages and strip bot mention tags
  return messages
    .map((msg) => (msg.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim())
    .filter((text) => text.length > 0);
}
