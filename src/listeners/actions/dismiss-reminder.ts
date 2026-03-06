import type { AllMiddlewareArgs, SlackActionMiddlewareArgs } from "@slack/bolt";

export async function dismissReminder({
  ack,
  respond,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs): Promise<void> {
  await ack();

  await respond({
    replace_original: true,
    text: "\ud83d\udc4d Reminder dismissed. Next check in 15 minutes.",
  });
}
