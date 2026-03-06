import { App } from "@slack/bolt";
import { appMention } from "./app-mention";
import { threadMessage } from "./thread-message";

export function registerEvents(app: App): void {
  app.event("app_mention", appMention);
  app.event("message", threadMessage);
}
