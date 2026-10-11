# Project tab

## Sub-features
Spec with progress, team, builder and its model picker, model usage, decisions, repository, vision, delete.

## How to get to it (user POV)
In a project, the "Project" tab of the side panel (a drawer below 1280 px).

## Driving it with pnpm verify
`pnpm verify drive project-tab --project <id>`: opens the tab and checks the builder line ("<agent> writes all the code").

## Gotchas
At 1440 px the panel is inline; narrower windows need the drawer button.
