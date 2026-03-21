## 2026-03-21 13:07 UTC
### Audit summary
- **Active crons:** 19 (17 KinBot + PinchChat + reddit-token-refresh)
- **Disabled crons:** 20

### Healthy crons (doing good work)
- **kinbot-add-tests** (8h, Opus) — 3131 tests now, very productive, last run added mini-app-docs tests
- **kinbot-ci-watchdog** (6h, Opus) — essential, catches breaks, recently re-triggered a flaky cron-tools test
- **kinbot-promo** (daily 14:00, Opus) — GitHub PRs, Reddit posts, working well
- **kinbot-docs-content** (6h, Opus) — writing docs, last run updated multiple doc pages
- **kinbot-code-scanning-fixer** (12h, Opus) — fixing CodeQL alerts, last fixed double escaping
- **kinbot-memory-research** (12h, Opus) — R&D, shipped improvements
- **kinbot-github-maintenance** (12h, Opus) — repo hygiene
- **kinbot-improve-site** (12h, Opus) — landing polish
- **kinbot-qa-explorer** (12h, Opus) — browser QA
- **kinbot-plugin-improve** (8h, Opus) — plugin system
- **kinbot-improve-cli** (daily, Opus) — installer improvements
- **kinbot-sse-reactivity** (daily, Opus) — SSE event coverage
- **kinbot-i18n-audit** (2 days, Opus) — i18n completeness
- **kinbot-consistency-guardian** (2 days, Opus) — refactoring, ran 347s last time
- **kinbot-community** (daily, Opus) — handles issues/PRs, last run 104s
- **kinbot-release** (daily 17:00 UTC, Opus) — "Nothing to release" last run (good)
- **PinchChat** (3x/day, Opus) — project in excellent shape, mostly finding nothing to do
- **reddit-token-refresh** (12h, Gemini Flash) — cheap, quick, 1.4s

### Issues found
None critical. All active crons are running cleanly.

### Disabled crons — status check
- **kinbot-e2e-tests** — correctly disabled, 3 consecutive 900s timeouts (agent keeps running Playwright locally despite explicit instructions). Leave disabled.
- **kinbot-dynamic-platforms** — disabled, never ran. Issue #239 scope. Leave disabled until Nicolas re-enables.
- **kinbot-teams** — disabled, feat/teams branch work. Leave disabled.
- All other disabled crons (Twitter, Moltbook, infra, email, etc.) — appropriately disabled.

### No action taken
Everything is running well. No changes needed.

### Standing proposals (for Nicolas to decide)
- **kinbot-ci-watchdog → Gemini Flash** (14th time proposing). 95%+ runs are "CI green ✅" in 8-11s on Opus. The watchdog just runs `gh run list` and checks the conclusion. When CI breaks, the fix usually involves `bun run build` + code edits which Flash can handle for TypeScript fixes. Massive cost savings potential.
- **PinchChat frequency reduction** — The project is feature-complete and in "excellent shape" per its own assessment. 3x/day on Opus is overkill when most runs find nothing to do. Suggest reducing to 1x/day or even every 2 days.

### Cost observations
- 19 active crons, 17 on Opus 4.6
- Cheapest: reddit-token-refresh (Flash, 1.4s)
- PinchChat runs are increasingly finding nothing to do (last ~10 runs: "nothing actionable", "codebase in excellent shape", "no changes needed")
- kinbot-ci-watchdog averages 8-11s for the "green" path on Opus

### Next audit focus
- Monitor if PinchChat continues to have nothing to do (candidate for frequency reduction)
- Check if kinbot-code-scanning-fixer self-disables when all alerts are fixed
- Review if any new coverage gaps have appeared in KinBot src/

## 2026-03-17 13:08 UTC
### Audit summary
- **Active crons:** 17 KinBot + 3 other (PinchChat, reddit-token-refresh, woodbrass-reply-check)
- **Disabled crons:** 18 (all appropriately disabled)

### Healthy crons (doing good work)
- **kinbot-add-tests** (8h, Opus) — 2500+ tests, very productive
- **kinbot-ci-watchdog** (6h, Opus) — essential, catches breaks
- **kinbot-promo** (daily 14:00, Opus) — GitHub PRs, Reddit posts
- **kinbot-docs-content** (6h, Opus) — writing docs
- **kinbot-code-scanning-fixer** (12h, Opus) — fixing CodeQL alerts
- **kinbot-memory-research** (12h, Opus) — R&D, shipping improvements
- **kinbot-github-maintenance** (12h, Opus) — repo hygiene
- **kinbot-improve-site** (12h, Opus) — landing polish
- **kinbot-qa-explorer** (12h, Opus) — browser QA
- **kinbot-plugin-improve** (8h, Opus) — plugin system
- **kinbot-improve-cli** (daily, Opus) — installer improvements
- **kinbot-sse-reactivity** (daily, Opus) — SSE event coverage
- **kinbot-i18n-audit** (2 days, Opus) — i18n completeness
- **kinbot-community** (12h, Opus) — handles issues/PRs
- **PinchChat** (3x/day, Opus) — webchat improvement
- **reddit-token-refresh** (12h, Gemini Flash) — cheap, quick
- **woodbrass-reply-check** (4h, Gemini Flash) — monitoring delivery

### Issues found

1. **kinbot-release** — 1 consecutive timeout (600s). Looking at run history, the last successful run took 586s (v0.22.0 release) which was cutting it very close. Before that, multiple runs exceeded 200s. The cron runs `bun test` which grows as test count increases (2500+ tests now). 
   - **Action:** No change yet. 1 timeout isn't a pattern, and the cron runs daily. If it times out again, will bump to 900s.

2. **kinbot-consistency-guardian** — 1 consecutive timeout (300s on the run before the config was updated to 600s). Already fixed by previous audit (bumped to 600s). Next run will verify.

3. **kinbot-e2e-tests** — Remains disabled. 3 consecutive 900s timeouts. The agent keeps running Playwright locally despite explicit instructions not to. Correctly disabled.

4. **kinbot-cron-manager** (this cron) — Timed out last run at 600s. The audit process of listing 40+ crons + checking run history for each is time-intensive. Need to be more efficient this run. No config change needed, just work faster.

### No action taken
Everything is running well. The previous audits have done a good job of tuning intervals and timeouts. No changes needed this run.

### Standing proposals (for Nicolas to decide)
- **kinbot-ci-watchdog → Gemini Flash** (13th time proposing). 95%+ runs are "CI green ✅" in 8-11s on Opus. Massive overkill. The fix-when-broken path could stay on Opus via a prompt that says "if green, stop; if red, escalate" but Flash can handle the green check trivially.
- **woodbrass-reply-check** — always finds nothing. Consider disabling once delivery is confirmed.
- **kinbot-release timeout** — monitor for next run. If it times out again, bump to 900s.

### Cost observations
- 17 active KinBot crons on Opus 4.6, all with 300-900s timeouts
- Cheapest: reddit-token-refresh (Flash, 0.8s) and woodbrass-reply-check (Flash, 4s)
- Most expensive by runtime: kinbot-add-tests (522s avg), kinbot-community (388s), PinchChat (300s)

### Next audit focus
- Monitor kinbot-release for second timeout
- Check if kinbot-consistency-guardian runs clean at 600s timeout
- Review if kinbot-code-scanning-fixer has self-disabled (should when all alerts fixed)
