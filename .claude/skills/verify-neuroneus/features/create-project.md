# Create a project

## Sub-features
Name, vision, team preset or hand-picked agents, then the kickoff huddle. With profile full, a GitHub repository and a setup build (Vercel project) start too.

## How to get to it (user POV)
"New project" in the top bar or sidebar, `/new`.

## Driving it with pnpm verify
`pnpm verify drive create-project [--name <text>] [--vision <text>]`: fills the form, keeps the default team, submits, waits for `/p/<id>` and for the kickoff huddle to end. Returns the `projectId`, the number of agent messages and whether a decision card is waiting.

## Gotchas
The kickoff runs real Azure models and can take minutes at maximum reasoning. In profile local the project shows "no repository": that is expected.
