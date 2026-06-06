# KinBot — marketing site

Astro + Tailwind. Design direction: **"app skin + editorial bones"** (see `../kinbot-1.0-design-directions.md`, tour 3) — keeps the KinBot app's aurora/glass/glow identity but uses an editorial structure (numbered sections, mono metadata, product-like panels, captioned figures) so it never reads as "AI-generated".

## Commands
```bash
cd site
bun install
bun run dev      # local dev (http://localhost:4321/kinbot)
bun run build    # static output -> dist/
bun run preview  # serve the build
```
Deployed as a GitHub Pages **project site** at `https://marlburrow.github.io/kinbot/` (hence `base: '/kinbot'` in `astro.config.mjs`).

## Where to drop your assets

**1. Avatars (JSON + images)** — `src/data/kins.json`
Each entry: `{ "name": string, "domain": string, "avatar": string | null, "status"?: "online" | "working" | "idle" }`
- Put avatar images in `public/avatars/` and set `"avatar": "/avatars/atlas.png"`.
- `null` avatar → a themed placeholder robot is shown automatically.
- `status` (optional) only affects the hero "// your kins" panel (first 5 entries).
- `name` + `domain` appear in the hero panel **and** the "household" directory.

**2. Screenshots** — `public/screens/`
Used in captioned figures (e.g. `Fig. 2 — a tool renders as UI`). They render with an automatic **feathered/blended** edge (no hard frame). Replace the placeholder block in `src/pages/index.astro` with an `<img src={...} />`. Suggested first shots: a custom-tool render (weather card), the context/token view, a mini-app.

**3. Provider / channel logos**
Channels use `simple-icons` via `astro-icon` (already wired). AI provider logos in the KinBot app use `@lobehub/icons` (color) — if you want those exact marks, drop SVGs into `public/providers/` or we add a small React island later.

## Notes
- Icons: `astro-icon` with `lucide` (UI) + `simple-icons` (brands).
- Fonts: Plus Jakarta Sans (app font) + JetBrains Mono (metadata), via Google Fonts.
- All design tokens live in `src/styles/global.css` and mirror the app's aurora palette.
