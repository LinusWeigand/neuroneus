# Language switch

## Sub-features
EN/DE segmented switch in the top bar; the choice is a cookie (`nn_locale`) and a server refresh.

## How to get to it (user POV)
Any page, top right: `EN | DE`.

## Driving it with pnpm verify
`pnpm verify drive language`: on `/new`, switches to German, waits for the server-rendered title and a client-rendered label in German, then switches back and checks both in English.

## Gotchas
Client components switch first and server components after the refresh: check one of each, and wait for them (never a one-shot `isVisible`).
