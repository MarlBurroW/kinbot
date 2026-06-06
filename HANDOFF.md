# KinBot 1.0 launch — handoff / context

> Read this first. It's the context for the 1.0 launch work (repo + GitHub Pages site + docs redo) done on branch `kinbot-1.0-launch`. Everything below is the source of truth; the linked docs go deeper.

## Mission

Redo, from scratch, everything *around* KinBot for a **1.0 release**: the GitHub repo presentation, the **GitHub Pages marketing site**, and the **documentation**. The product changed a lot since the last release; the old material is stale. The site is also being fully redesigned. **Site/repo/docs language: English.**

## Validated decisions (locked)

- **Category framing:** KinBot is a **self-hosted platform of autonomous, persistent personal AI agents ("Kins")** — NOT a chat UI. Never let it be compared to plain chat front-ends (Open WebUI, LobeChat); compare to autonomous-agent peers (OpenClaw, Hermes).
- **Licence:** open-source **MIT**.
- **Tone:** grand-public-rassurant up top, technical sections lower.
- **Primary audience (go-to-market):** power-user solo / homelabbers. Families/small teams = post-1.0 expansion.
- **Tagline:** **"Your AI team. At home."**
- **Pillar order (messaging):** 1) persistent agents that remember & collaborate · 2) self-hosted **& self-improving** (one container; Kins build their own tools/mini-apps/plugins) · 3) a genuinely nice agent UI (PWA) · 4) conversational onboarding (Sherpa) · 5) omnichannel + channel handoff · (+) trust (vault never-to-LLM, token transparency).
- **Design direction:** **"app skin + editorial bones"** — keep the app's aurora/glass/glow identity (Plus Jakarta Sans, lucide, lobehub provider icons) but use an **editorial structure** (numbered sections, mono metadata/colophon, product-like panels, captioned figures, restraint on glows). **Dark only.** Canonical reference mockup: `design-preview/foyer-dark-v2.html`.
- **Hard rules:** **zero em-dashes (—) anywhere** (use comma/colon/period or `·`); avoid AI-slop tells (see anti-ai-slop doc); UI simulations must mirror the real app components (see SRC tags), otherwise use a feathered screenshot placeholder.

## Document index (all written for this launch)

**Strategy & positioning**
- `kinbot-1.0-catalogue-capacites.md` — exhaustive capability catalog (reference, from a multi-agent sweep of the codebase).
- `kinbot-1.0-strategie-communication.md` — communication/positioning strategy (current, with validated decisions, pillars, comparison).
- `kinbot-1.0-messaging.md` — tagline, hero copy, 30s pitch, brand voice.

**Analysis & design**
- `kinbot-1.0-anti-ai-slop.md` — how to avoid the "AI-generated" look + honest audit of our mockups.
- `kinbot-1.0-design-directions.md` — 3 explored directions + the chosen one (tour 3: app skin + editorial bones).

**Site & docs**
- `kinbot-1.0-site-architecture.md` — site IA + page-by-page wireframes.
- `kinbot-1.0-doc-plan.md` — documentation plan (Starlight-style), by pillar.
- `README-1.0-draft.md` — draft of the new repo README (not yet promoted to README.md).
- `site/README.md` — the Astro site's asset/JSON contract (where to drop avatars, screenshots, provider logos).

**Video**
- `kinbot-video/PLAN.md` — 13-scene shot list + timecodes + editing notes.
- `kinbot-video/script.json` — VO lines (source of truth; pins voice `MarlburroW Pro`, id `zIg9jXuiKoQ2eqokLUZ8`).
- `kinbot-video/generate-vo.mjs` — ElevenLabs VO generator. Run: `ELEVENLABS_API_KEY=<key> bun kinbot-video/generate-vo.mjs` (targets voice "marlburrow" by name; `ELEVENLABS_VOICE_ID`/`ELEVENLABS_VOICE_NAME` override).
- `kinbot-video/audio/` — generated VO (`full.mp3` ~2:45 + `scene-01..13.mp3`).

**Cleanup notes**
- `strategie-communication-positionnement.md` — older first-draft duplicate of `kinbot-1.0-strategie-communication.md`. Safe to delete.
- `hermes-memory-comparison.md` — pre-existing (not part of this work).

## The site (`site/`)

- **Stack:** Astro + Tailwind (chosen over the old Vite/React site, which is **not** carried over — it lives only in `main`'s git history; was archived locally as `site-old/`, intentionally not pushed).
- **Run:** `cd site && bun install && bun run dev` → http://localhost:4321/kinbot . Build: `bun run build`. **GitHub Pages project site**, `base: '/kinbot'`.
- **Design system:** `site/src/styles/global.css` (aurora tokens mirror the app). Icons: `astro-icon` (lucide + simple-icons) + `@lobehub/icons` for provider marks (SSR-only, no client JS).
- **Homepage** (`site/src/pages/index.astro`) is a one-pager: hero + product-like "your kins" panel, channel strip, install **video placeholder** (`#demo`), numbered sections 01 memory · 02 self-host/vault · 03 self-improving/tools · 04 omnichannel+handoff · 05 transparency (context viewer) · 06 Sherpa onboarding · 07 the household (examples) · Providers & plugins · Why KinBot (honest comparison vs OpenClaw/Hermes) · Get started · footer.
- **Data:** `site/src/data/kins.json` drives the hero panel + household grid (`{name, domain, avatar, status?}`).
- **Faithful sims** mirror real components: recall → `src/server/tools/memory-tools.ts`; context viewer → `src/server/services/context-preview.ts`; provider icons → `src/client/components/common/ProviderIcon.tsx` (lobehub whitelist). Token cache is provider-agnostic (`token-usage.ts`), not "Anthropic".
- **Placeholders to replace with real captures** (feathered `.shot` slots): Fig.2 tool render, Fig.3 channel handoff, Fig.5 Sherpa onboarding, and the install video (`site/public/videos/install.mp4`).

## Logo & avatars

- **Logo:** `site/public/logo.svg` (aurora Kin head) + `src/client/components/common/KinbotLogo.tsx` (themable React component for the app). Now used in the site nav/footer.
- **6 logo proposals** in `design-preview/logos/c1..c6.svg` (c1 Kin head, c2 monogram K, c3 bubble+face, c4 constellation, c5 orbit, c6 home+face). Board: `design-preview/logos-board.png`. **Final not chosen yet** → then make favicon + apple-touch-icon + OG image.
- **Brand colors (theme):** aurora `#AE5AF9` (violet) → `#FB5FCA` (magenta) → `#FFB470` (orange/peach). Primary violet `#C180FF`. Note: current `logo.svg` uses a slightly deeper set (`#7C4DFF`/`#E158C8`/`#FF9E6D`) — decide whether to realign to the exact theme colors.
- **Avatars:** source in `kinbot-specialist-avatars/` (`avatars.json` + 20 JPGs, Pixar-style, generated via the app's avatar pipeline). Resized copies served from `site/public/avatars/` (384px). Only **Sherpa is built-in**; the rest are examples (the household section says so, "e.g." tags).

## Open items / next steps

- [ ] Pick the final **logo**, then generate **favicon / apple-touch-icon / OG** from it.
- [ ] Record the **install video** (per `kinbot-video/PLAN.md`) and embed it in the `#demo` section (replace placeholder with `<video>`). VO audio is ready in `kinbot-video/audio/`.
- [ ] Add **real product screenshots** into the feathered slots (Fig.2/3/5) — `site/public/screens/`.
- [ ] Build the **pages**: `/features`, `/docs` (or Starlight), `/why`, `/roadmap`.
- [ ] **CI for GitHub Pages** (auto-deploy `site/` build).
- [ ] Promote `README-1.0-draft.md` → `README.md` (verify repo facts: `MarlBurroW/kinbot`, port 3000, image `ghcr.io/marlburrow/kinbot`).
- [ ] Delete the duplicate `strategie-communication-positionnement.md`; eventually drop `site-old/`.
- [ ] Confirm OpenClaw/Hermes comparison marks (best-effort from public docs).

## Conventions

English copy. No em-dashes. Reuse the app's design tokens/icons. Faithful UI sims or honest placeholders. Avatars/names from `kins.json`. Marketing compares against autonomous-agent platforms, never plain chat UIs.
