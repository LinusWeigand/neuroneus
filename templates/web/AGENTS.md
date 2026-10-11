# Building {{name}}

A web app: Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4, deployed on Vercel after every task. The spec is in `docs/SPEC.md`, the design system in `DESIGN.md` (short version: `docs/DESIGN-BRIEF.md`). Build exactly what the spec says.

## Structure: one supported way

| Path | What goes there |
|---|---|
| `app/` | Routes only: pages and layouts that compose features. Thin. |
| `features/<feature>/` | Everything one feature needs: `components/`, `actions.ts` (Server Actions), `queries.ts` (reads). A feature never imports another feature's files; share through `components/ui` or `lib`, or the other feature's `index.ts`. |
| `components/ui/` | Shared UI primitives built to DESIGN.md: button, input, card, dialog, empty state. |
| `app/globals.css` | DESIGN.md's tokens in `@theme`. The only place colors are defined. |
| `lib/` | Shared helpers. |

## Rules and what enforces them

The build runs ESLint first (`npm run build`), so these fail the deploy:

| Rule | Enforced by |
|---|---|
| No comments. Say it with names and types. | `app/no-comments` |
| Colors only through the tokens in `app/globals.css`, never hex in code. | `app/no-hex-colors` |
| Features don't reach into each other. | `app/feature-boundaries` |
| No `any`, no `@ts-ignore`. | TypeScript, ESLint |

Judgment rules, checked by a reviewer who opens every deploy and compares it to the spec:
- Every screen follows DESIGN.md: its tokens, type scale, components, do's and don'ts.
- Empty, loading and error states exist and look designed.
- Works on a phone (390 px) and a desktop (1440 px).
- Next.js 16: `params` and `searchParams` are Promises; `cookies()` and `headers()` are async; mutations are Server Actions followed by `revalidatePath`.

## Data
{{storage}}
