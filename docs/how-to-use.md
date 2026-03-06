# Incident Slack Bot — How to Use & Test

## Setup

1. **Install & configure**
   ```bash
   npm install
   cp .env.example .env
   # Fill in: SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, ANTHROPIC_API_KEY, BETTERSTACK_API_KEY
   ```

2. **Run locally**
   ```bash
   npm run dev          # starts on port 3000
   ngrok http 3000      # expose to Slack
   ```
   Set your Slack app's Request URL to `https://<ngrok-id>.ngrok.io/slack/events`.

3. **Optional integrations**
   - `BETTERSTACK_STATUS_PAGE_ID` — enables public status page updates
   - `PYLON_API_TOKEN` — enables customer issue tracking in Pylon

---

## Commands

All commands work by mentioning the bot in Slack:

| Command | What it does |
|---------|-------------|
| `@bot <description>` | Drafts an incident from the message + thread context. Shows Approve/Deny buttons. |
| `@bot summarize` | Generates a timeline summary of the current thread (title, status, timeline, affected chains). |
| `@bot update` | Generates a status update draft from thread context with Approve/Deny buttons. |

---

## Workflow

1. **Report** — Someone describes an issue in a Slack thread
2. **Mention the bot** — `@bot` in the thread to draft an incident
3. **Review** — Bot posts a draft with title, status, summary, and affected chains
4. **Approve or Deny** — Click the button
   - **Approve** → Creates incident in Better Stack, posts to status page (if configured), creates Pylon issue (if configured), enables auto-reminders
   - **Deny** → Dismisses the draft
5. **Auto-reminders** — Every 15 min, the bot checks active incident threads and suggests updates with Approve/Dismiss buttons
6. **Resolve** — When thread activity indicates resolution, the bot suggests marking it resolved

---

## Testing

### Quick smoke test

1. Start the bot (`npm run dev` + ngrok)
2. In a Slack channel, post a message like: _"Ethereum RPC is returning 503 errors for the past 10 minutes"_
3. Reply in the thread: `@bot`
4. Verify the bot posts a draft with title, status, summary, and affected chains
5. Click **Approve** → confirm it creates the incident in Better Stack
6. Click **Deny** on a separate test → confirm it dismisses

### Test each command

| Test | Steps | Expected |
|------|-------|----------|
| **Incident draft** | Post a problem description, mention `@bot` in thread | Draft with Approve/Deny buttons |
| **Summarize** | In an active thread, mention `@bot summarize` | Timeline summary posted in thread |
| **Update** | In an active thread, mention `@bot update` | Update draft with Approve/Deny |
| **Chain detection** | Mention specific chains (e.g. "Polygon", "Arbitrum") in thread, then `@bot` | Chains listed in draft |
| **Low confidence chains** | Vague message with no chain names, then `@bot` | Warning asking to specify chains |
| **Auto-reminders** | Approve an incident, wait 15 min (or temporarily lower `REMINDER_INTERVAL_MS`) | Bot posts suggested update in thread |
| **Resolve flow** | In thread, post "issue is resolved", then `@bot update` | Status shows "resolved" |

### Build & lint

```bash
npm run build    # should compile with no errors
npm run lint     # should pass
```
