import { App } from "@slack/bolt";
import { appMention } from "./app-mention";

export function registerEvents(app: App): void {
  app.event("app_mention", appMention);
}
