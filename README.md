# Neuroneus

A group chat where a team of AI agents plans software with you. You bring an idea, the agents hold a short, sharp huddle (each from their own area of responsibility), and then you get a card with the few decisions only you can make. Every project gets its own repository in the `neuroneus-agents` GitHub org, and every decision is committed to `docs/DECISIONS.md` there.

Next.js 16 · Tailwind 4 · AI SDK 7 on Azure AI Foundry · Drizzle on Neon Postgres · GitHub App · Vercel

## How a turn works

1. **You post** in the room, or answer a decision card.
2. **The moderator passes the floor.** A fast model call (`floorInstructions` in `src/lib/engine/prompts.ts`) decides who speaks next and gives that agent a private focus ("challenge Atlas on cost"). Code-level guardrails the model can't override:
   - nobody speaks twice in a row
   - in an open question, everyone in the room speaks once before the huddle can end, with at most `n + 2` messages in total
   - `@Name` mentions get a direct answer from that agent, plus at most one other
   - after you answer a card, exactly one agent confirms the plan and the next step
3. **Agents speak one at a time**, streamed live. They are prompted like senior coworkers in Slack: at most two sentences, a concrete position, `@mentions` when disagreeing, no recaps.
4. **Decision synthesis.** One structured call turns the huddle into 1 to 3 questions. Each question has a preselected recommended option first, one or two concrete alternatives with the agents who argued for them, and "Something else…" for your own answer. Keys `1` to `4`, `←`/`→` and Enter work.
5. **Your answers** are stored, appended to the repo's `docs/DECISIONS.md`, and fed back into every later prompt as locked decisions.

The run streams as NDJSON from `POST /api/projects/:id/turn`. It holds a per-project lock (one huddle at a time) and keeps running and persisting if the browser disconnects (`waitUntil`). A reloaded page catches up by polling. **Stop** ends the huddle after the current message.

## Spec first: web app or web game

Nothing gets built until the spec is complete:

1. **Classify.** On creation the description is read into a spec (`src/lib/spec/extract.ts`): web app or web game, plus every point it already answers. If it's unclear whether it's an app or a game, that's the first question.
2. **Two templates** (`src/lib/spec/templates.ts`), from established practice:
   - **Web app** (PRD): problem & goal, target users, core user journeys, MVP scope, out of scope, data & saving, accounts & access, content & language, look & feel, success criteria (+ edge cases).
   - **Web game** (one-page GDD): pitch & genre, core loop, goal/win/lose, controls & devices, rules & mechanics, difficulty & progression, feedback & screens, visual style, players & saving, out of scope (+ theme & language).
3. **Ask, most important first.** Every chat message updates the spec. While points are open, the huddle works on them and the decision card asks the top three open points in priority order, with concrete options from the team. After an answer, a short round on the next points and the next card follow.
4. **Spec complete →** the design system is chosen, the team confirms, and building starts automatically. "Build now" stays disabled until then. The Project tab shows the spec with every answer.

The stack is never a question: always a Next.js web app on Vercel, and a Neon database only if the spec needs data stored on a server.

## A design system per app

Each app gets one `DESIGN.md` from the [awesome-claude-design](https://github.com/VoltAgent/awesome-claude-design) catalog (68 systems). When the spec completes, a design lead agent picks the system that fits the audience and mood (`src/lib/design/choose.ts`), and the platform installs it into the app's repo, the same file `npx getdesign add <slug>` writes (templates ship in the `getdesign` package). The builders' `AGENTS.md` makes DESIGN.md binding: its tokens in `app/globals.css`, its typography, components and do's and don'ts.

## How the agents build the app

Every project is also a running app:

1. **On creation** a setup round gives the project a Vercel project, commits a Next.js 16 + Tailwind placeholder to the project repo, and deploys it. When the spec completes, the first round adds a Neon database (Frankfurt) if the spec needs one, the design system, `docs/SPEC.md`, the agents' conventions and, for games, a canvas game shell. The live URL appears in the workspace's **App** panel within about a minute.
2. **When you answer a decision card** (or press **Build now**), a build round starts. The planner (`src/lib/build/planner.ts`) turns vision, decisions and recent chat into 1 to 5 small, deployable tasks and assigns each to a team member.
3. **Each task**: the builder agent (`src/lib/build/agent.ts`) edits the source with file tools, the change is committed to GitHub under the agent's name, `db/schema.sql` is applied to the app's database, and the app is redeployed. The App panel reloads when the step goes live, and the agent posts one product-level line in the chat.
4. **If a deploy fails**, the build output goes back to the agent as a fix task (up to 2 tries). If it still fails, the repo is rolled back to the last version that deployed and the round moves on, so the live app never breaks.

While a round runs, nothing sits still: the builder streams, so the App panel shows what each agent is doing this second ("Writing app/page.tsx · 2.4k chars", thinking, reading, searching), a log of what it did, Vercel's build stages, a progress bar per task and ticking timers. A strip above the composer shows the same on mobile. The client polls a light `/api/projects/:id/activity` endpoint about once a second. A task that needs longer than one step saves its conversation and continues in the next step.

Each agent can run on its own model (Project tab → Model): GPT-5.4 mini, 5.4, 5.5 and the 5.6 family, all Azure deployments in the EU data zone. "Auto" uses a fast model in chat and a stronger one for code.

Rounds run as a chain of short steps (`src/lib/build/engine.ts`), each under the 300 s function limit, with their state in Postgres. A lease keeps one step running at a time, and open workspaces act as a watchdog that resumes a stalled chain.

Deploys go through Vercel's API with the files inline, not Vercel's GitHub integration: on the Hobby plan, Git-triggered deploys of private repos are blocked when the commit author (our GitHub App) isn't the account owner.

## The agents

Ten predefined roles in `src/lib/agents.ts`, each with an area it owns and a deliberate stance so discussions produce real tradeoffs: Nova (Product), Atlas (Architecture), Iris (Design), Forge (Frontend), Kernel (Backend), Sentinel (Security & Privacy), Vega (QA), Orbit (DevOps), Delta (AI), Rook (Devil's Advocate). A project has 2 to 6 of them, chosen per room, with presets.

## Local development

```bash
pnpm install
cp .env.example .env.local   # fill in Azure, GitHub App and DATABASE_URL
pnpm db:migrate
pnpm dev
```

`pnpm huddle new` runs a whole huddle in the terminal, which is the quickest way to iterate on prompts.

## Deploying on Vercel

1. Import this repository as a new Vercel project.
2. **Storage → Neon**: connect a database. This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. Migrations run automatically on every build (`scripts/migrate.ts`).
3. **Environment variables**: everything in `.env.example`, including `NEON_API_KEY` and `VERCEL_API_KEY` for app building. Notes:
   - `GITHUB_PRIVATE_KEY` must be the PEM contents (or base64 of it). File paths don't exist on Vercel.
   - `APP_PASSWORD` is required. A production deployment without it refuses to serve, because the app spends Azure credits and writes to your GitHub org.
4. Redeploy after adding the variables.

Huddles run up to ~60 s inside one function call; the turn route sets `maxDuration = 300`, which needs Fluid compute (the default for new Vercel projects).

## Languages

The UI is available in English and German (switch in the top bar). The first visit follows the browser's language, and the choice is remembered in a cookie. All copy lives in `src/lib/i18n/dictionaries.ts`. Agents always reply in the language you write in.

## Design

The UI follows `DESIGN.md` (ElevenLabs-inspired): off-white canvas, warm ink, light editorial serif display, ink pill CTAs, pastel gradient orbs as atmosphere only. Tokens are in `src/app/globals.css`.
