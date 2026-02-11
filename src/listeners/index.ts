import { App } from "@slack/bolt";
import { registerEvents } from "./events";

export function registerListeners(app: App): void {
  registerEvents(app);
}
