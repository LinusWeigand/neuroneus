# Huddle

## Sub-features
Composer (Enter sends, Shift+Enter breaks lines, @ mentions an agent), streamed agent replies, the decision card after the huddle, Stop.

## How to get to it (user POV)
A project, the composer at the bottom.

## Driving it with pnpm verify
`pnpm verify drive huddle --project <id> [--message <text>]`: sends the message, waits for the run to end, reloads, and counts new agent messages.

## Gotchas
A new message supersedes an open card. One run at a time per project: a second send gets "the team is still talking".
