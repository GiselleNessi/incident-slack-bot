import "dotenv/config";
import { App, ExpressReceiver } from "@slack/bolt";
import { registerListeners } from "./listeners";

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
})();
