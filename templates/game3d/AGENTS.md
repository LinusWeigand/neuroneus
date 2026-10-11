# Building {{name}}

A 3D web game: Next.js 16 (static page), Three.js (WebGL) with `postprocessing`, TypeScript strict, deployed on Vercel after every task. The spec is in `docs/SPEC.md`, the look in `docs/ART-DIRECTION.md`. Build exactly what the spec says.

## How the game is put together

| File | What it is | You |
|---|---|---|
| `game/play.ts` | The game itself: player, world objects, rules, score, camera. Ships as a placeholder. | Replace it with the real game. |
| `game/main.ts` | Renderer, scene, camera, the frame loop and the screen flow (loading, title, play, paused, over). | Extend it; keep the flow. |
| `game/store.ts` | The game state the HUD shows (`screen`, `score`, `lives`, `best`, …) and the `actions` the HUD calls. Mirrors itself into the probe. | Add fields the HUD needs; change state only with `store.set`. |
| `components/hud.tsx` | Title screen, HUD, pause menu and game over, as HTML over the canvas. | Adapt it to the game. All UI lives here. |
| `game/world.ts` | Sky, fog, lights with shadows, ground and scenery. | Shape it to the game's world. |
| `game/models.ts` | Loads every model in `game/assets.ts`; `instance(models, key, size)` gives a copy scaled to `size` world units, standing on the ground. | Use it for every model. |
| `game/assets.ts` | The asset manifest: model and image keys and paths. Generated. | Read it; load assets by key. |
| `game/palette.ts`, `app/palette.css`, `app/fonts.ts` | Colors, look and fonts of the art direction. Generated. | Read; never write colors elsewhere. |
| `game/text.ts` | Every word the player sees, in the game's language. | Add strings here. |
| `game/juice.ts` | Game feel: `shake`, `burst` (particles), `pop` (scale punch). | Use on every player action. |
| `game/look.ts` | Post-processing: bloom, vignette, tone mapping, anti-aliasing from the palette. | Tune it through `LOOK` in `game/palette.ts`. |
| `game/input.ts` | Keyboard and touch (a virtual stick) as one `Input` with `x`, `y` and `action`. | Use instead of raw events. |
| `game/sfx.ts` | Sound effects (ZzFX): `sfx.play("pickup" | "hit" | "explode" | "jump" | "select" | "powerup" | "lose" | "start")`. | Play one on every action. |
| `game/probe.ts` | State the platform reads to verify the game. `store.set` keeps it current. | Leave it. |

## Rules and what enforces them

The build runs ESLint first (`npm run build`), so these fail the deploy:

| Rule | Enforced by |
|---|---|
| No comments. Say it with names and types. | `app/no-comments` |
| Colors only through the palette: `hex()` / `css()` from `game/color.ts` in the engine, `game-*` Tailwind colors (`bg-game-surface`, `text-game-primary`) in the HUD. | `app/no-hex-colors` |
| Menus, HUD and screens live in `components/hud.tsx` (or `components/hud/`); other components only mount the game. | `app/ui-in-engine` |
| Assets load by key from `game/assets.ts`, never by path. | `app/no-raw-asset-paths` |
| No `any`, no `@ts-ignore`. | TypeScript, ESLint |

Judgment rules, checked by a reviewer who plays every deploy and compares it to the target screenshot:
- Every player action gets feedback: a sound, a particle burst, a pop or shake, the score number popping in the HUD.
- The camera frames the action the way the target screenshot does; it follows smoothly (lerp), never snaps.
- Models keep their proportions: size them with `instance(models, key, size)` to the sizes in `docs/ART-DIRECTION.md`. Lights cast shadows; objects that matter cast them too.
- Bright things glow: give pickups and effects emissive materials in palette colors so the bloom catches them.
- The HUD uses `font-game-display` for numbers and titles, `font-game-body` for the rest, and the palette colors. Nothing important within 24 px of the edges.
- Works with keyboard and touch. Pause on Esc, P and when the tab loses focus.
- The reviewer starts the game with Space or a click and reads `scene`, `score`, `lives` and `over` from the probe.
- Keep allocations out of the frame loop: reuse vectors and geometries, dispose what you remove.
- You can't add model, image or sound files. Build what's missing from Three.js geometry in the palette.

## Saving
{{storage}}
