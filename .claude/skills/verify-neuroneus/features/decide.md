# Decision card

## Sub-features
Options per question (recommended first), "Something else…", keys 1–4 and arrows, "Accept all recommended" when there are several questions. Spec questions write straight into the spec.

## How to get to it (user POV)
The card under the huddle in a project.

## Driving it with pnpm verify
`pnpm verify drive decide --project <id>`: accepts the recommended options and waits for the confirming run.

## Gotchas
Answering the last open spec point completes the spec and, in profile full, starts the first build round.
