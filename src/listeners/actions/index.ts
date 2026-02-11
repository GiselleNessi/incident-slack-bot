import { App } from "@slack/bolt";
import { approveIncident } from "./approve-incident";
import { denyIncident } from "./deny-incident";

export function registerActions(app: App): void {
  app.action("approve_incident", approveIncident);
  app.action("deny_incident", denyIncident);
}
