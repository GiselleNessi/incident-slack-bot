import type { AllMiddlewareArgs, SlackActionMiddlewareArgs } from "@slack/bolt";

export async function denyIncident({
  ack,
  respond,
}: AllMiddlewareArgs & SlackActionMiddlewareArgs): Promise<void> {
  await ack();

  await respond({
    replace_original: true,
    text: "\u274c *Incident Denied* — No changes were made.",
  });
}
