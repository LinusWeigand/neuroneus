# Delete a project

## Sub-features
Lists what goes (repository, live app and Vercel project, database, history), asks for the name, deletes outside resources first and the project last.

## How to get to it (user POV)
Project tab, bottom: "Delete project".

## Driving it with pnpm verify
`pnpm verify drive delete-project --project <id>`: types the name, deletes, expects the redirect home and a 404 from the project API.

## Gotchas
With profile full this deletes real GitHub, Vercel and Neon resources. If one fails, the project stays and a retry deletes only what's left.
