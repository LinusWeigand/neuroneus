<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working in Neuroneus

Neuroneus is a group chat where a team of AI agents plans software with a human, then builds, verifies and ships it. Generated apps live in their own repositories in the `neuroneus-agents` GitHub org and follow their own rules (`src/lib/build/template.ts`).

## How to work

- Start non-trivial work with `/poteto-mode` (pstack, vendored in `.claude/skills/`, see `PSTACK.md`). State a finish condition that can pass or fail.
- Done means proven in the running app, not "it compiles": drive the feature you touched with `pnpm verify` (skill `verify-neuroneus`) and show the evidence paths.
- Before pushing: `pnpm lint && pnpm typecheck && pnpm test`. CI runs the same, the build, and a verify smoke run.
- Small commits, each one a verifiable unit.
- When the operator corrects the same mistake twice, run `/correct`: make it impossible (architecture, then types, then a lint rule or test) and add a row to the table below. Docs are the last resort, because nothing fails when an agent skips them.

## Rules and what enforces them

| Rule | Enforced by |
|---|---|
| No comments. Intent lives in names, types, tests and lint rules. | `neuroneus/no-comments` (autofix) |
| A lint exception carries a reason and an expiry: `-- why (until YYYY-MM-DD)`. | `neuroneus/disable-needs-reason` |
| UI colors come from the tokens in `src/app/globals.css`, never hex. | `neuroneus/no-hex-colors` |
| Visible copy lives in `src/lib/i18n/dictionaries.ts`, in English and German. Server components use `getT()`, client components `useI18n()`. | `neuroneus/no-jsx-text`, `dictionaries.test.ts` |
| Client components never import server-only modules. | `neuroneus/client-server-boundary` |
| Hot paths never read full build rows; build blobs only through `src/lib/build/blobs.ts`. Database transfer is metered (a full row per poll once exhausted the quota). | `neuroneus/no-heavy-build-reads` |
| Every model call spreads `callSettings()` (reasoning effort, room for reasoning tokens, no stored generations). | `neuroneus/model-calls-use-call-settings`, `ai.test.ts` |
| No `any`, no `@ts-ignore`. | `@typescript-eslint/no-explicit-any`, `ban-ts-comment` |
| The browser theme color matches the canvas token. | `brand.test.ts` |
| Huddles: required speakers always speak, nobody twice in a row, capped turns. | `arrangeTurns`, `huddle.test.ts` |
| Agents answer in the human's language, decided in code. | `humanLanguage`, `small.test.ts` |
| Building starts only when the spec is complete. | `startBuild` gate, `templates.test.ts` |
| UI follows `DESIGN.md`: Newsreader 300 for display (never bold), Inter 400/500 for body, the ink pill is the only CTA color, gradient orbs are decoration. | Judgment, `pnpm verify` screenshots |
| Never ask the human about the stack: Next.js on Vercel, plus Neon only when data must be stored on a server. | Judgment, `SCOPE` in `src/lib/engine/prompts.ts` |

## Where things live

- `src/lib/engine/`: the discussion. `run.ts` runs a turn: read the message into the spec, plan the huddle in one call, let agents speak, distill a decision card. Pure rules are in `huddle.ts` and `card.ts`, prompts in `prompts.ts`. `pnpm huddle` runs one turn without the UI.
- `src/lib/spec/`: web app (PRD) and web game (GDD) templates. Open points are asked most important first; nothing is built before the spec is complete.
- `src/lib/build/`: building apps. `engine.ts` is a state machine advanced one short step at a time over HTTP (each step under the 300 s function limit, leased, resumed by a watchdog that open workspaces poll). `agent.ts` is the one builder agent, `planner.ts` plans a round, `infra.ts` provisions the repository, Vercel project and Neon database, `template.ts` is what a generated app starts from and the rules it follows.
- `src/lib/ai.ts`: every model is an Azure AI Foundry deployment (EU data zone where offered); `src/lib/usage.ts` records every call.
- `src/lib/db/`: Drizzle on Neon. Migrations in `drizzle/` run on every build (`scripts/migrate.ts`).
- Generated apps deploy through Vercel's API with inline files: Vercel Hobby blocks Git deploys of commits by our GitHub App on private repositories.
