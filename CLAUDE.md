# CLAUDE.md — AI Assistant Guide for incident-slack-bot

## Project Overview

**incident-slack-bot** is a Slack bot for incident management. It helps teams declare, track, coordinate, and resolve incidents directly from Slack.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript (strict mode)
- **Slack SDK**: `@slack/bolt` v4 with `ExpressReceiver` (HTTP mode)
- **AI**: `@anthropic-ai/sdk` (Claude API for incident interpretation)
- **Env config**: `dotenv`
- **Package Manager**: npm
- **Linting**: ESLint with `@typescript-eslint`
- **Formatting**: Prettier

## Project Structure

```
incident-slack-bot/
├── src/
│   ├── index.ts                        # Entry point — creates Bolt app, starts server
│   ├── listeners/
│   │   ├── index.ts                    # Registers all listener categories
│   │   ├── commands/                   # Slash command handlers (empty, for future use)
│   │   ├── events/
│   │   │   ├── index.ts               # Registers event listeners on the app
│   │   │   └── app-mention.ts         # Responds to @mentions
│   │   ├── actions/                    # Interactive component handlers (empty, for future use)
│   │   └── shortcuts/                  # Shortcut handlers (empty, for future use)
│   ├── services/
│   │   └── claude.ts                  # Claude API — interprets incident messages
│   ├── models/                         # Data models (empty, for future use)
│   ├── utils/                          # Shared utilities (empty, for future use)
│   └── types/                          # TypeScript type definitions (empty, for future use)
├── .env.example                        # Environment variable template
├── .gitignore
├── .prettierrc
├── package.json
├── tsconfig.json
└── CLAUDE.md
```

## Development Workflow

### Getting Started

```bash
npm install
cp .env.example .env
# Fill in SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET in .env
npm run dev
```

For Slack to reach your local server, expose port 3000 via ngrok:

```bash
ngrok http 3000
```

Then set your Slack app's **Request URL** to `https://<ngrok-id>.ngrok.io/slack/events`.

### Common Commands

| Command          | Purpose                          |
| ---------------- | -------------------------------- |
| `npm run dev`    | Run with ts-node (development)   |
| `npm run build`  | Compile TypeScript to `dist/`    |
| `npm start`      | Run compiled build (production)  |
| `npm run lint`   | Run ESLint                       |
| `npm run format` | Run Prettier                     |

### Environment Variables

Defined in `.env` (see `.env.example`):

| Variable               | Description                          |
| ---------------------- | ------------------------------------ |
| `SLACK_BOT_TOKEN`      | Bot user OAuth token (`xoxb-...`)    |
| `SLACK_SIGNING_SECRET` | Slack app signing secret             |
| `ANTHROPIC_API_KEY`    | Anthropic API key (`sk-ant-...`)     |
| `PORT`                 | Server port (default: `3000`)        |

## Architecture

### App Initialization (`src/index.ts`)

The app uses `ExpressReceiver` from Bolt for HTTP mode. This means Slack sends events to an HTTP endpoint (`/slack/events`) rather than using Socket Mode. The receiver is created first, then passed to the Bolt `App` constructor.

### Listener Registration Pattern

Listeners are organized by type under `src/listeners/` and wired up through a chain of `register*` functions:

1. `src/listeners/index.ts` — top-level `registerListeners(app)` calls category registrars
2. `src/listeners/events/index.ts` — `registerEvents(app)` binds each event handler
3. `src/listeners/events/app-mention.ts` — the actual handler function

To add a new listener:
1. Create a handler file in the appropriate subdirectory (e.g., `src/listeners/commands/my-command.ts`)
2. Export the handler function
3. Import and register it in the category's `index.ts`
4. If it's a new category, wire it into `src/listeners/index.ts`

### Service Layer

Business logic goes in `src/services/`, separate from Slack handler code. Handlers should be thin — call `ack()` (for interactive payloads), delegate to a service, and reply.

#### Claude Service (`src/services/claude.ts`)

`interpretIncidentMessage(text)` sends a Slack message to Claude and returns structured data:

```ts
type IncidentInterpretation = {
  incident_title: string;           // Short title (≤10 words)
  status: "investigating" | "resolved";
  summary: string;                  // One-sentence timeline entry
};
```

Throws `ClaudeParseError` (with `rawResponse` property) if Claude returns invalid JSON or a mismatched schema.

## Coding Conventions

### General

- TypeScript strict mode is enforced via `tsconfig.json`
- Prefer `const` over `let`; never use `var`
- Use named exports over default exports
- Keep functions small and single-purpose

### Naming

- **Files**: `kebab-case.ts` (e.g., `app-mention.ts`)
- **Types/Interfaces**: `PascalCase` (e.g., `IncidentStatus`)
- **Functions/Variables**: `camelCase` (e.g., `appMention`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants

### Slack-Specific

- Register all listeners under `src/listeners/`, organized by type
- Use `ack()` immediately in interactive handlers before doing async work
- Reply in threads using `thread_ts: event.ts` to keep channels clean

## For AI Assistants

When working on this codebase:

1. **Read before writing** — always read existing files before making changes
2. **Follow existing patterns** — match the listener registration pattern and file naming
3. **Keep changes minimal** — only modify what is necessary for the task
4. **Run checks** — execute `npm run build` and `npm run lint` after making changes
5. **No over-engineering** — avoid adding abstractions or configuration beyond what is requested
6. **Update this file** — if you add significant new patterns, dependencies, or architecture, update CLAUDE.md
