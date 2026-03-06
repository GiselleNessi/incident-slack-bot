import "dotenv/config";
import { App, ExpressReceiver } from "@slack/bolt";
import { registerListeners } from "./listeners";
import { startAutoReminders } from "./services/auto-reminders";

const requiredEnv = ["SLACK_BOT_TOKEN", "SLACK_SIGNING_SECRET"] as const;
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(", ")}`);
  console.error("Check your .env file — see .env.example for reference.");
  process.exit(1);
}

const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET!,
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
});

registerListeners(app);

(async () => {
  const port = Number(process.env.PORT) || 3000;
  await app.start(port);
  console.log(`⚡ Incident bot is running on port ${port}`);

  // Start auto-reminder loop (checks active incidents every 15 min)
  startAutoReminders(app.client);
})();
