# Home

## Sub-features
The landing page with the hero, team presets and the projects list (signed in).

## How to get to it (user POV)
Open `/`.

## Driving it with pnpm verify
`pnpm verify drive home`: loads `/` and reads the first heading.

## Gotchas
Signed out, `/` redirects to `/login`; `drive` signs in first with the instance's test password.
