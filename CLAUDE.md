# CLAUDE.md — AI Assistant Guide for incident-slack-bot

## Project Overview

**incident-slack-bot** is a Slack bot for incident management. It helps teams declare, track, coordinate, and resolve incidents directly from Slack.

> This is a new repository. This file should be updated as the codebase evolves.

## Repository Status

This project is in its initial setup phase. There is no application code yet. The sections below define the conventions and structure to follow as the project is built out.

## Intended Tech Stack

_(To be confirmed as the project takes shape)_

- **Runtime**: Node.js
- **Language**: TypeScript
- **Slack SDK**: `@slack/bolt` (Slack Bolt framework)
- **Package Manager**: npm or pnpm
- **Testing**: Jest or Vitest
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier

## Project Structure (Planned)

```
incident-slack-bot/
├── src/
│   ├── app.ts              # Bolt app initialization and startup
│   ├── listeners/          # Slack event, action, and command handlers
│   │   ├── commands/       # Slash command handlers
│   │   ├── events/         # Event listeners (e.g., message, reaction)
│   │   ├── actions/        # Interactive component action handlers
│   │   └── shortcuts/      # Global/message shortcut handlers
│   ├── services/           # Business logic (incident lifecycle, notifications)
│   ├── models/             # Data models / database schemas
│   ├── utils/              # Shared utility functions
│   └── types/              # TypeScript type definitions
├── tests/                  # Test files mirroring src/ structure
├── .env.example            # Environment variable template
├── package.json
├── tsconfig.json
├── CLAUDE.md               # This file
└── README.md
```

## Development Workflow

### Getting Started

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Fill in SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, etc.

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Common Commands

| Command          | Purpose                        |
| ---------------- | ------------------------------ |
| `npm run dev`    | Start dev server with hot reload |
| `npm run build`  | Compile TypeScript to JavaScript |
| `npm start`      | Run compiled production build  |
| `npm test`       | Run test suite                 |
| `npm run lint`   | Run ESLint                     |
| `npm run format` | Run Prettier                   |

### Environment Variables

Key variables expected (see `.env.example` when created):

- `SLACK_BOT_TOKEN` — Bot user OAuth token (`xoxb-...`)
- `SLACK_SIGNING_SECRET` — Slack app signing secret
- `SLACK_APP_TOKEN` — App-level token for Socket Mode (`xapp-...`)
- `PORT` — Server port (default: 3000)

## Coding Conventions

### General

- Use TypeScript strict mode
- Prefer `const` over `let`; never use `var`
- Use named exports over default exports
- Keep functions small and focused on a single responsibility
- Handle errors explicitly — avoid silent catches

### Naming

- **Files**: `kebab-case.ts` (e.g., `incident-manager.ts`)
- **Types/Interfaces**: `PascalCase` (e.g., `IncidentStatus`)
- **Functions/Variables**: `camelCase` (e.g., `createIncident`)
- **Constants**: `UPPER_SNAKE_CASE` for true constants (e.g., `MAX_RETRIES`)

### Slack-Specific

- Register all listeners in the `src/listeners/` directory, organized by type
- Keep Slack Block Kit JSON builders in utility functions, not inline in handlers
- Use Slack's `ack()` immediately in all interactive handlers before doing work
- Use Socket Mode for development; HTTP mode for production

### Testing

- Place test files alongside source or in a mirrored `tests/` directory
- Name test files with `.test.ts` suffix
- Test business logic in `services/` independently from Slack handlers
- Mock Slack client calls in tests

## Key Architectural Decisions

1. **Slack Bolt Framework**: Use `@slack/bolt` as the primary framework for handling Slack interactions
2. **Listener Organization**: Separate listeners by type (commands, events, actions, shortcuts) for maintainability
3. **Service Layer**: Keep business logic in `services/` separate from Slack handler code to enable testability
4. **TypeScript Strict**: Enforce strict TypeScript for type safety across the project

## For AI Assistants

When working on this codebase:

1. **Read before writing** — always read existing files before making changes
2. **Follow existing patterns** — match the style and structure already in place
3. **Keep changes minimal** — only modify what is necessary for the task
4. **Run checks** — execute `npm test` and `npm run lint` after making changes
5. **No over-engineering** — avoid adding abstractions, features, or configuration beyond what is requested
6. **Update this file** — if you add significant new patterns, dependencies, or architectural changes, update CLAUDE.md to reflect them
