# KinBot Cron Manager Journal

## 2026-03-09 13:02 UTC
### Audit summary
- **Active KinBot crons:** 18
- **Non-KinBot active:** PinchChat, woodbrass-reply-check, reddit-token-refresh, bot-chronicles

### Healthy (productive, no issues)
- **kinbot-community** (4h, Opus) — Implementing issues, reviewing PRs. 295s runs. Productive.
- **kinbot-add-tests** (8h, Opus, 900s) — 284s runs. Steady test growth.
- **kinbot-plugin-improve** (8h, Opus) — 224s runs. Plugin system improvements.
- **kinbot-docs-content** (6h, Opus, 600s) — 167s runs. Docs accuracy reviews.
- **kinbot-memory-research** (12h, Opus, 600s) — 110s runs. R&D work.
- **kinbot-github-maintenance** (12h, Opus) — 217s runs. Good hygiene.
- **kinbot-improve-site** (12h, Opus, 600s) — 253s runs. Landing page polish.
- **kinbot-qa-explorer** (12h, Opus, 900s) — 769s runs. Finding real bugs. Long but productive.
- **kinbot-release** (1x/day 17:00 UTC, Opus) — v0.19.0 shipped. 202s runs.
- **kinbot-promo** (1x/day 14:00 Paris, Opus) — 151s runs. GitHub PRs, Reddit, Twitter.
- **kinbot-ci-watchdog** (6h, Opus) — CI green. 8s runs 95%+ of the time.
- **kinbot-improve-cli** (24h, Opus, 600s) — 145s runs. Installer improvements.
- **kinbot-sse-reactivity** (24h, Opus) — 277s runs. SSE event fixes.
- **kinbot-i18n-audit** (48h, Opus) — 71s runs. Appropriate interval.
- **kinbot-consistency-guardian** (48h, Opus) — 19s runs. Appropriate interval.
- **kinbot-cron-manager** (1x/day 14:00 Paris, Opus) — This cron. Working.

### Non-KinBot crons (active)
- **PinchChat** (2x/day, Opus) — 180s runs. Working.
- **woodbrass-reply-check** (4h, Gemini Flash) — 1.4s runs. Always finds nothing. Unchanged since last time Nicolas was asked.
- **reddit-token-refresh** (12h, Gemini Flash) — 1.4s runs. Minimal cost.
- **bot-chronicles-daily** (1x/day 10h Paris, main session systemEvent) — Last ran Mar 5. Next Mar 10. Working.

### Issues found & actions taken

1. **kinbot-e2e-tests: 3 consecutive timeouts (900s)** ⚠️
   - **Problem:** The cron keeps running Playwright tests locally, which takes 600-900s+, causing timeouts. Recent runs show it spending all time running full suites or multiple tests locally instead of just writing tests and letting CI validate.
   - **Action:** Reduced timeout from 900s to 600s (force it to be faster) and added stronger instruction: "DO NOT run Playwright tests locally if CI is green and you're just adding new tests. Write the test, commit, let CI validate." This should break the loop of local test execution causing timeouts.

### Proposals (for Nicolas to decide)

1. **Model downgrade: kinbot-ci-watchdog** → Gemini Flash (7th time proposing). 95%+ runs are "CI is green ✅" in 8s on Opus. When CI breaks, it does fix things, but the fix capability could work on a cheaper model. This single cron runs 4x/day on Opus for 8 seconds of work. Significant cost savings.

2. **woodbrass-reply-check** — Still running every 4h, always finding nothing (1.4s on Flash). Cheap but pointless. Consider disabling once the delivery question is resolved.

### Cost analysis
- 30 commits in git log. v0.19.0 released. Good productivity.
- Most crons are well-tuned. The ecosystem has matured since earlier audits.
- Main cost concern remains ci-watchdog on Opus (trivial task, expensive model).

### Next audit focus
- Verify kinbot-e2e-tests stops timing out with the new prompt guidance
- Monitor if any crons are doing duplicate work (multiple crons editing same files)
- Check if bot-chronicles is actually producing articles or just echoing the prompt

## 2026-03-06 21:04 UTC
### Audit summary
- **Active KinBot crons:** 17 (after disabling kinbot-docs-theme)
- **Non-KinBot active:** PinchChat, woodbrass-reply-check, reddit-token-refresh, bot-chronicles

### Healthy (productive, no issues)
- **kinbot-docs-content** (2h, Opus) — Excellent. Full docs site migrated, accuracy reviews underway. Memory section rewritten with full pipeline docs.
- **kinbot-add-tests** (2h, Opus, 900s) — Steady. 484s runs, fixing and adding tests.
- **kinbot-plugin-improve** (2h, Opus) — Productive. Store plugins, bug fixes.
- **kinbot-memory-research** (3h, Opus, 600s) — Deep R&D. 325s runs, implementing real improvements.
- **kinbot-ci-watchdog** (3h, Opus) — Working as intended. ~8s when green, fixes real CI breaks.
- **kinbot-promo** (4x/day, Opus) — Active on GitHub, Reddit, Twitter.
- **kinbot-qa-explorer** (4h, Opus, 900s) — Finding real bugs, filing issues.
- **kinbot-community** (4h, Opus, 600s) — Implementing issues, reviewing PRs. 410s runs.
- **kinbot-github-maintenance** (4h, Opus) — Good hygiene work.
- **kinbot-improve-site** (4h, Opus, 600s) — Landing page improvements.
- **kinbot-consistency-guardian** (12h, Opus) — Refactoring, extracting shared components.
- **kinbot-i18n-audit** (12h, Opus) — Appropriate interval.
- **kinbot-sse-reactivity** (12h, Opus) — SSE event fixes.
- **kinbot-e2e-tests** (6h, Opus, 600s) — Fixing real E2E failures.
- **kinbot-improve-cli** (6h, Opus, 600s) — CLI installer improvements.
- **kinbot-release** (3x/day, Opus) — v0.14.0 shipped.

### Issues found & actions taken

1. **kinbot-docs-theme: COMPLETED, still running every 30min** ⚠️
   - Last run literally said "Theme is complete. Nothing left to do here." with all 7 priority items checked off.
   - Was running every 30min on Opus, burning tokens for nothing.
   - **Action: DISABLED.** Task is done. If Nicolas wants further theme tweaks, he can re-enable it.

2. **woodbrass-reply-check: too frequent**
   - Running every 1h, completing in ~600ms each time (Gemini Flash). Always finds nothing.
   - Cheap model but still wasteful at 24 runs/day.
   - **Action: Changed interval from 1h to 4h.** Still catches replies same-day.

3. **Rate limiting wave (earlier today)**
   - kinbot-ci-watchdog, kinbot-docs-content, and kinbot-docs-theme all hit API rate limits around 13:00-17:00 UTC.
   - With docs-theme now disabled, one less Opus consumer.

### Proposals (for Nicolas to decide)

1. **Model downgrade: kinbot-ci-watchdog** → Gemini Flash (6th time proposing). 90%+ runs are "CI is green ✅" in 8s. Opus is massive overkill for checking `gh run list`. When CI actually breaks, Flash can still read logs and make fixes.

2. **`.marlbot-context.md` still missing** (6th time noting). Every KinBot cron references it. Either recreate it or remove references.

3. **woodbrass-reply-check** — Consider disabling entirely once Nicolas confirms the delivery is resolved. It's been running for days with zero hits.

### Cost analysis
- 30 commits in git log. Docs site (content + theme) dominated today's output.
- v0.14.0 released.
- Disabling docs-theme saves ~48 Opus runs/day (every 30min). Significant cost savings.

### Next audit focus
- Monitor if any cron has become redundant now that docs site is complete
- Check if kinbot-ci-watchdog really needs Opus
- Verify rate limiting improves with one fewer active cron
