# Building {{name}}

A 2D web game: Next.js 16 (static page), Phaser 4 (WebGL), TypeScript strict, deployed on Vercel after every task. The spec is in `docs/SPEC.md`, the look in `docs/ART-DIRECTION.md`. Build exactly what the spec says.

## How the game is put together

| File | What it is | You |
|---|---|---|
| `game/scenes/play.ts` | The game itself: world, player, rules, score. Ships as a placeholder. | Replace it with the real game. |
| `game/scenes/title.ts`, `pause.ts`, `game-over.ts` | Title screen, pause overlay, game over with best score. | Adapt them to the game (keep them in the engine). |
| `game/scenes/boot.ts` | Loads every asset in `game/assets.ts` and the fonts. | Leave it. |
| `game/assets.ts` | The asset manifest: image keys and paths. Generated. | Read it; load assets by key. |
| `game/palette.ts`, `app/palette.css`, `app/fonts.ts` | Colors, look and fonts of the art direction. Generated. | Read; never write colors elsewhere. |
| `game/text.ts` | Every word the player sees, in the game's language. | Add strings here. |
| `game/ui.ts` | In-engine UI: `label`, `panel`, `button`, `menu`, `hudCounter`. | Build all menus and HUD with it. |
| `game/juice.ts` | Game feel: `shake`, `flash`, `hitStop`, `popText`, `squash`, `burst`, `trail`, `float`, `pulse`, `go`, `arrive`. | Use on every player action. |
| `game/look.ts` | Post-processing: bloom, vignette, color grade from the palette, on the world camera. Objects at depth `HUD_DEPTH` (9000) or above are HUD: a second camera draws them crisp, unfiltered and unshaken. | Call `applyLook(this)` in each scene's `create`; give HUD elements `setDepth(HUD_DEPTH)`. |
| `game/backdrop.ts` | The background (painted art if present, else a gradient with glow). | Call `backdrop(this)` first in each scene. |
| `game/controls.ts` | Keyboard, mouse and touch (on-screen stick and button) as one `Controls`. | Use instead of raw input. |
| `game/sfx.ts` | Sound effects (ZzFX): `sfx.play("pickup" | "hit" | "explode" | "jump" | "select" | "powerup" | "lose" | "start")`. | Play one on every action. |
| `game/probe.ts` | State the platform reads to verify the game: `probe.set({ scene, score, lives, over, paused })`. | Keep it current. |
| `game/textures.ts` | Procedural textures (`spark`, `glow`, `dot`, `star`, `diamond`). | Add drawn textures here when no art exists. |
| `docs/skills/phaser/*.md` | Phaser 4's official docs for agents, one topic each. | Read the topic before using an API you aren't sure of: Phaser 4 differs from 3 (filters replaced FX; no Bloom filter, use `Phaser.Actions.AddEffectBloom`). |

## Rules and what enforces them

The build runs ESLint first (`npm run build`), so these fail the deploy:

| Rule | Enforced by |
|---|---|
| No comments. Say it with names and types. | `app/no-comments` |
| Colors only through `game/palette.ts` (`hex()`, `css()`, `PALETTE`). | `app/no-hex-colors` |
| Menus, HUD and screens are built in the engine (`game/ui.ts`); React only mounts the game. | `app/ui-in-engine` |
| Assets load by key from `game/assets.ts`, never by path. | `app/no-raw-asset-paths` |
| No `any`, no `@ts-ignore`. | TypeScript, ESLint |

Judgment rules, checked by a reviewer who plays every deploy and compares it to the target screenshot:
- Every player action gets feedback: a sound, a particle burst, a little shake or squash, floating score text.
- Sprites keep their aspect ratio; size them with `setDisplaySize(w, w * (img.height / img.width))` to the display sizes in `docs/ART-DIRECTION.md`.
- The game fills the screen (1280×720, scaled to fit). Nothing important within 24 px of the edges.
- Works with keyboard and touch. Pause on Esc, P and when the tab loses focus.
- Keep `probe` current: the reviewer starts the game with Space or a tap and reads `scene`, `score`, `lives` and `over`.
- You can't add image or sound files. Draw what's missing with `game/textures.ts` or `Graphics`, in the palette.

## Saving
{{storage}}
