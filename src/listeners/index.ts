import { App } from "@slack/bolt";
import { registerActions } from "./actions";
import { registerEvents } from "./events";

export function registerListeners(app: App): void {
  registerEvents(app);
  registerActions(app);
}
