import type { AllMiddlewareArgs, SlackEventMiddlewareArgs } from "@slack/bolt";

export async function appMention({
  event,
  say,
}: AllMiddlewareArgs & SlackEventMiddlewareArgs<"app_mention">): Promise<void> {
  await say({
    text: "Incident bot online.",
    thread_ts: event.ts,
  });
}
