# KinBot — Launch Readiness Scorecard

*Run #8 — 2026-02-25*

Focus: **Grade every launch prerequisite against reality. What's ready, what's blocking, what's the critical path.**

---

## Scoring

- ✅ **Ready** — done, no action needed
- ⚠️ **Partial** — exists but needs work
- ❌ **Missing** — blocker, must fix before launch

---

## 1. Repository First Impression

| Item | Status | Notes |
|------|--------|-------|
| Tagline in H1 | ✅ | "AI agents that actually remember you." — strong, memorable |
| README first screen | ✅ | Hero section with badges, table, quote. Well-structured |
| Badges (stars, license, Docker, release) | ✅ | All present, consistent |
| Quick Start (docker one-liner) | ✅ | `docker run` + curl installer + compose. Solid |
| Feature list | ✅ | Detailed with collapsible section. Good balance |
| Architecture diagram | ⚠️ | ASCII diagram in README — functional but won't "pop" on first scroll |
| Screenshots / GIF demo | ❌ | **CRITICAL BLOCKER.** Zero visual proof of the product. No screenshots, no GIFs, no images in the repo. A UI product without visuals is dead on arrival on Reddit/HN. |
| Contributing guide | ⚠️ | Check if CONTRIBUTING.md exists |
| Open issues / PRs | ⚠️ | Needs a few "good first issue" labels to attract contributors post-launch |

**Verdict: 6/9 — blocked by missing screenshots**

---

## 2. GitHub Pages / Landing Site

| Item | Status | Notes |
|------|--------|-------|
| Hero section | ✅ | Video preview, tagline, install command, GitHub stats. Polished |
| Video demo | ✅ | `preview1.mp4` auto-plays in hero. Strong differentiator |
| OG meta tags | ⚠️ | Title, description, type, URL all set. **But `og:image` is MISSING.** Social shares will have no image preview — this kills click-through on Reddit, Twitter, Discord. |
| Twitter Card | ⚠️ | `twitter:image` also missing. Same problem. |
| Feature breakdown | ✅ | Features.tsx, Comparison.tsx, WhatIsKin.tsx — comprehensive |
| FAQ | ✅ | License, providers, privacy all answered correctly (AGPL-3.0, 25+) |
| Install section | ✅ | Present with copy-to-clipboard |
| Provider logos/list | ✅ | Providers.tsx exists |
| Mobile responsive | ⚠️ | Untested — worth a quick check before launch |

**Verdict: 7/9 — blocked by missing OG image**

---

## 3. Social Proof & Seeds

| Item | Status | Notes |
|------|--------|-------|
| GitHub stars (organic seed, 5-10 min) | ❌ | Needs Nicolas to get friends/colleagues to star before public launch |
| Docker image published | ✅ | `ghcr.io/marlburrow/kinbot:latest` referenced in README |
| At least 1 release tagged | ✅ | Release badge in README pulls from GitHub |
| Active commit history | ✅ | Shows the project is alive and maintained |
| Issue templates | ⚠️ | Check if `.github/ISSUE_TEMPLATE/` exists |

**Verdict: 3/5 — needs star seeding**

---

## 4. Launch Posts (Drafts)

| Item | Status | Notes |
|------|--------|-------|
| r/selfhosted draft | ✅ | In `03-visibility-strategy.md`. Solid, needs provider count updated to 25+ |
| HN Show HN draft | ✅ | Same file. Good tone. Same provider count fix needed |
| Twitter/X thread | ✅ | Same file. 4-tweet thread ready |
| r/LocalLLaMA angle | ⚠️ | Title only, no body draft. Needs fleshing out |
| Objection responses | ✅ | `07-objection-handling.md` — comprehensive, well-toned |

**Verdict: 4/5 — minor updates needed**

---

## 5. Technical Launch Readiness

| Item | Status | Notes |
|------|--------|-------|
| Docker Compose tested from scratch | ⚠️ | Exists but should be tested on a clean machine |
| curl installer tested | ⚠️ | `install.sh` exists — needs fresh Ubuntu/macOS test |
| Onboarding wizard works | ⚠️ | Mentioned in README — verify it actually runs post-install |
| Site deployed & accessible | ✅ | marlburrow.github.io/kinbot |

**Verdict: 1/4 confirmed — needs testing sweep**

---

## Critical Path to Launch

### 🔴 BLOCKERS (must fix)

1. **Create OG image** (1200x630px)
   - Use the KinBot logo + tagline on a dark background matching the site palette
   - Add to `site/public/og-image.png`
   - Add `<meta property="og:image" content="https://marlburrow.github.io/kinbot/og-image.png" />` and same for `twitter:image`
   - **Impact:** Without this, every link share on Reddit/Twitter/Discord shows a blank preview. This alone can halve click-through rates.

2. **Add screenshots to README**
   - Minimum 3: (a) Dashboard with multiple Kins, (b) Conversation showing memory recall, (c) Settings/providers page
   - Place in `docs/images/` or `assets/screenshots/`
   - Embed in README after the feature table
   - **Impact:** A UI product without screenshots screams "not ready." This is the #1 trust signal for self-hosters browsing GitHub.

3. **Seed 5-10 GitHub stars**
   - Ask colleagues, friends, FASST team
   - A repo at 0 stars won't get traction on r/selfhosted. Even 10 stars signals "someone cared enough"

### 🟡 SHOULD FIX (before launch, not blockers)

4. Update provider count in `03-visibility-strategy.md` drafts (14 → 25+)
5. Write r/LocalLLaMA post body (Ollama-first angle)
6. Add `CONTRIBUTING.md` if missing
7. Create 2-3 "good first issue" labels on GitHub
8. Test Docker install from scratch on clean environment
9. Quick mobile responsiveness check on the site

### 🟢 NICE TO HAVE (can iterate post-launch)

10. Animated GIF version of the demo video for README (loads faster than video link)
11. Product Hunt listing
12. awesome-selfhosted PR (wait 2 weeks post-launch)

---

## Estimated Effort

| Task | Time | Who |
|------|------|-----|
| OG image | 30 min | Marlbot (image gen) or Nicolas (design) |
| Screenshots (3-5) | 20 min | Nicolas (run the app, screenshot) |
| Add screenshots to README | 10 min | Nicolas or Marlbot |
| Seed stars | 5 min | Nicolas (share link with friends) |
| Update post drafts | 15 min | Marlbot |
| r/LocalLLaMA draft | 15 min | Marlbot |
| CONTRIBUTING.md | 20 min | Marlbot |
| Total pre-launch | ~2h | |

---

## Bottom Line

KinBot's **content** is ready — the README is strong, the site is polished, the post drafts are solid, the objection playbook is prepared. What's missing is **visual proof**: no OG image, no screenshots. For a product with a beautiful UI, this is the biggest gap.

**The three things standing between KinBot and a successful launch:**
1. Screenshots in the README
2. OG image for social previews
3. A handful of seed stars

Fix those three, and KinBot is launch-ready.
