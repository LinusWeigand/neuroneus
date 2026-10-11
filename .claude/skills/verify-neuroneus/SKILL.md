---
name: verify-neuroneus
description: Drive a real Neuroneus instance (the Next.js app in this repo) the way a user does and capture evidence. Use it to prove a change works before you call it done, to reproduce a bug, or when asked to verify, repro or show proof in the app.
---

# Verify Neuroneus

`pnpm verify` is the control CLI (`scripts/verify/cli.mts`, Playwright). Every command prints one JSON object and exits 1 when `ok` is false. A change is done when the feature it touches passes here, not when it compiles.

## Launch

1. The scratch database must answer: `pg_isready -h localhost -p 5433`. If it doesn't, start it (it lives in a scratch dir and vanishes with /tmp):
   ```bash
   D=/tmp/nn-pgdata; [ -d $D ] || initdb -D $D -U postgres --auth=trust >/dev/null
   mkdir -p /tmp/nnpg && LC_ALL=en_US.UTF-8 pg_ctl -D $D -o "-p 5433 -k /tmp/nnpg" -l $D.log start
   createdb -h localhost -p 5433 -U postgres neuroneus 2>/dev/null; pnpm db:migrate
   ```
2. `pnpm verify launch` builds and starts a production instance on a free port from 3400, behind the real password gate with a random test password kept in `.verify/instance.json`.
   - `--profile local` (default) blanks GitHub, Vercel and Neon credentials, so creating a project touches nothing outside this machine. Azure models still run.
   - `--profile full` keeps them: projects get real repositories, Vercel projects and databases. Use it only when the task is about building or deploying, and delete what you create (`drive delete-project`).
3. Ready means `launch` returned `ok: true`. It runs next to a dev server without conflict.

## Doctor

`pnpm verify doctor` checks the process, the home page, signing in, the database and the Azure settings. Run it first whenever anything looks off. `--url http://localhost:3300` checks an instance launch didn't start (set `VERIFY_PASSWORD` if it has one).

## Drive

`pnpm verify drive <feature> [--project <id>] [--message <text>] [--name <text>] [--vision <text>]`. The feature map in `features/` says what each one proves. `pnpm verify features` lists them. The browser runs in English (`nn_locale=en`) and finds controls by the labels in `src/lib/i18n/dictionaries.ts`, so a copy change can't silently break a drive.

For waits: `pnpm verify wait-run --project <id>` (a huddle) and `pnpm verify wait-build --project <id>` (a build round, prints its stages).

## Evidence

Each drive writes `.verify/evidence/<timestamp>-<feature>/`: screenshots plus `result.json` with the checks and any page errors. Proof standards:
- Drive the user path (the form, the composer, the card), never internal endpoints in place of the UI.
- Check the result the user sees and the side effect behind it (the API state after the action).
- Report a failing drive as a finding. Don't change the feature map to make it pass.
- Show the screenshot paths in your reply.

## Cleanup

`pnpm verify cleanup` stops the instance `launch` started, by its recorded process group. It never kills anything by name and never deletes evidence. Projects created with `--profile full` are cleaned up with `drive delete-project`, which also deletes their repository, Vercel project and database.
