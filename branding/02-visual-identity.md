# KinBot — Visual Identity Brief

*Run #2 — 2026-02-25*

---

## Brand Personality (in visual terms)

| Trait | Expression |
|-------|-----------|
| **Alive, not disposable** | Warm, organic shapes. Avoid cold/clinical tech aesthetics. |
| **Self-hosted / indie** | Approachable, craft feel. Not corporate SaaS. Think indie game studio, not enterprise. |
| **Memory & continuity** | Visual motifs of connection, threads, growth, layers. |
| **Multi-agent collaboration** | Multiple distinct entities working together. Not a single chatbot bubble. |

**In one sentence:** KinBot should feel like a cozy workshop of AI specialists who know you by name, not a sterile dashboard.

---

## Logo Concepts

### Direction A: "The Living Node"
- A stylized **neural/organic node** with 2-3 connected satellites
- Represents: Kins as distinct entities connected to each other
- Style: Rounded, slightly playful, single-weight line art
- Think: the warmth of the Bun logo meets the connectivity of a constellation
- The central node could subtly suggest a face/personality (two dots for eyes, nothing more)

### Direction B: "Memory Thread"
- An **infinity loop or Möbius strip** made of a conversation thread
- Represents: continuous memory, never-ending sessions
- Style: Clean, geometric but with rounded terminals
- Variation: the loop could contain a small brain/spark at the intersection

### Direction C: "The Kin Circle"
- **3-4 small avatar-like circles** arranged in a loose cluster or orbit
- Represents: multiple agents, collaboration, community
- Style: Friendly, colorful, each circle a different hue from the palette
- Think: Slack's logo energy but less corporate, more organic

**Recommendation:** Direction A is the strongest. It captures both identity (the central node with personality) and collaboration (connected satellites). It's also the most distinctive, the hardest to confuse with existing projects.

---

## Color Palette

### Primary Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Primary** | Deep Indigo | `#4F46E5` | Logo, CTAs, links, primary actions |
| **Accent** | Warm Amber | `#F59E0B` | Highlights, badges, "memory" visual motif |
| **Surface** | Soft Slate | `#1E293B` | Dark backgrounds, code blocks, cards |
| **Light Surface** | Cloud | `#F8FAFC` | Light mode backgrounds |
| **Success** | Emerald | `#10B981` | Status indicators, connected states |

### Rationale
- **Indigo** signals depth, intelligence, trust. Common in dev tools but the amber accent keeps it warm.
- **Amber** is the "memory" color. Warm, persistent, like a lamp that stays on. Use it for memory-related UI elements.
- **Slate** anchors the dark mode. Not pure black (too harsh), not blue-gray (too corporate).

### Secondary / Kin Colors
Each Kin gets a distinct accent from the existing 8 palettes (Aurora, Ocean, Forest, etc.). The brand palette is for the *platform*, not the individual agents.

---

## Typography

| Use | Font | Why |
|-----|------|-----|
| **Headings** | Inter or Geist | Clean, modern, excellent readability. Geist (by Vercel) ties into the Bun/Vercel AI SDK ecosystem subtly. |
| **Body** | Same as headings | Keep it simple. One font family, weight variations only. |
| **Code** | Geist Mono or JetBrains Mono | Developer audience expects quality monospace. |

**Rule:** No more than 2 font families total (one sans, one mono). KinBot is a dev tool with soul, not a design agency site.

---

## Iconography Style

- **Lucide icons** (already in the stack via shadcn/ui) — stick with them
- Style: 1.5px stroke, rounded caps, consistent with logo line weight
- For Kin-specific icons: use simple, recognizable metaphors (brain for memory, lightning for automation, shield for vault, etc.)

---

## Visual Motifs to Use

### 1. The "Always On" Indicator
- A small, subtle **glowing dot** (amber or green) near Kin avatars or the logo
- Communicates: "this agent is alive, remembering, available"
- Like a server status light, but warmer

### 2. Memory Layers
- When showing memory/history, use **stacked translucent cards** or **depth layers**
- Communicates: depth of memory, accumulated knowledge
- Avoid timeline metaphors (too linear), prefer depth/layers (more accurate to how memory works)

### 3. Connection Lines
- Thin, slightly curved lines between Kins in diagrams and illustrations
- Not rigid arrows (too workflow-y), not dots (too neural-network-y)
- Organic curves that suggest conversation, not data flow

---

## What to Avoid

- ❌ **Robot/android imagery** — KinBot agents aren't robots, they're specialized minds
- ❌ **Brain illustrations** — overused in AI branding, instantly forgettable
- ❌ **Gradient soup** — one gradient max (indigo → amber for special moments)
- ❌ **Dark-only design** — must work beautifully in both light and dark modes
- ❌ **Chat bubble as logo** — screams "another chat app", which is exactly the wrong message
- ❌ **Corporate blue + white** — every SaaS does this. The amber warmth is the differentiator.

---

## Favicon & Social Preview

### Favicon
- The logo mark (Direction A node) at 32x32 and 16x16
- Should be recognizable as a single color on any background
- Test: does it look distinct in a browser tab next to GitHub, Discord, and Reddit?

### Open Graph / Social Preview Image (1200x630)
- Left: Logo + "KinBot" wordmark
- Right: One-liner tagline ("AI agents that actually remember you")
- Background: dark slate with subtle amber glow
- This is what people see when the GitHub link is shared on Discord/Twitter/Reddit. Make it count.

---

## Deliverables Needed (ordered by impact)

1. **Logo** (SVG, mark + wordmark) — needed for README, site, social, favicon
2. **Open Graph image** (1200x630 PNG) — immediate GitHub/social sharing impact
3. **Favicon set** (16, 32, 180, 512) — site polish
4. **Color tokens** (CSS custom properties) — consistency across site and README badges
5. **Screenshot template** — consistent frame/background for app screenshots in README

---

## For the Logo Designer (or AI generation prompt)

> Design a minimal logo for "KinBot", a self-hosted AI agent platform. The logo should feature a stylized central node with 2-3 smaller connected satellite nodes, suggesting both personality (the main node has a subtle face-like quality from two small dots) and collaboration (the satellites). Style: rounded, single-weight line art, modern but warm. Primary color: deep indigo (#4F46E5) with amber (#F59E0B) accent on the connection lines or a subtle glow. The overall feeling should be "alive, intelligent, connected" — not cold or corporate. Must work at 16x16 favicon size.

---

## Next Steps

- [ ] Generate logo candidates (use the prompt above with image gen tools)
- [ ] Create Open Graph image once logo is finalized
- [ ] Define CSS color tokens and apply to site
- [ ] Create screenshot template for README
