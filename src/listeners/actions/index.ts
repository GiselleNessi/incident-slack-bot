import { App } from "@slack/bolt";
import { approveIncident } from "./approve-incident";
import { approveReminder } from "./approve-reminder";
import { denyIncident } from "./deny-incident";
import { dismissReminder } from "./dismiss-reminder";

export function registerActions(app: App): void {
  app.action("approve_incident", approveIncident);
  app.action("deny_incident", denyIncident);
  app.action("approve_reminder", approveReminder);
  app.action("dismiss_reminder", dismissReminder);
}
