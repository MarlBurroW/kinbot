# KinBot Cron Manager Journal

## 2026-03-12 13:05 UTC
### Audit summary
- **Active KinBot crons:** 18
- **Non-KinBot active:** PinchChat, woodbrass-reply-check, reddit-token-refresh

### Healthy (productive, no issues)
- **kinbot-community** (8h, Opus) — 18s last run. Working.
- **kinbot-add-tests** (8h, Opus, 900s) — 284s. Steady.
- **kinbot-plugin-improve** (8h, Opus) — 224s. Working.
- **kinbot-docs-content** (6h, Opus, 600s) — 145s. Working.
- **kinbot-github-maintenance** (12h, Opus) — 349s. Working.
- **kinbot-improve-site** (12h, Opus, 600s) — 200s. Working.
- **kinbot-qa-explorer** (12h, Opus, 900s) — 220s. Finding bugs, filing issues.
- **kinbot-release** (1x/day 17:00 UTC, Opus) — 150s. v0.19.3 shipped.
- **kinbot-ci-watchdog** (6h, Opus) — 9s last run. CI green.
- **kinbot-improve-cli** (24h, Opus, 600s) — 145s. Working.
- **kinbot-sse-reactivity** (24h, Opus) — 277s. Working.
- **kinbot-i18n-audit** (48h, Opus) — 231s. Working.
- **kinbot-consistency-guardian** (48h, Opus) — 19s. Working.
- **reddit-token-refresh** (12h, Flash) — 1.7s. Minimal.
- **PinchChat** (2x/day, Opus) — 118s. Working.

### Issues found & actions taken

1. **kinbot-e2e-tests: 3 consecutive timeouts (900s), prompt rewritten, awaiting next run** ⚠️
   - Last 3 runs all timed out at 900s. The prompt was completely rewritten with "⛔⛔⛔ YOU MUST NOT RUN PLAYWRIGHT ⛔⛔⛔" and explicit allowlist of commands. Timeout set to 300s.
   - The prompt update happened AFTER the last 3 timeout runs (updatedAt > lastRunAt). Next scheduled run should test the new prompt.
   - If it STILL times out: **disable it**. The kinbot-ci-watchdog already catches CI failures including E2E.

2. **kinbot-promo: Timed out at 300s, now 2 consecutive errors** ⚠️
   - GitHub PR workflows (fork, clone, edit, push, create PR) are slow. 300s was too tight.
   - **Action: Bumped timeout from 300s to 600s.** Currently running right now.

3. **kinbot-memory-research: 1 timeout (600s)** ⚠️
   - Single timeout, not a pattern. This cron does deep R&D work and has been incredibly productive (cross-encoder rerank, stale pruning, consolidation improvements, source context enrichment). 600s is sometimes tight for research + implementation runs.
   - **No action.** One timeout is acceptable. If it becomes 3 consecutive, will investigate.

### Proposals (for Nicolas to decide)

1. **Model downgrade: kinbot-ci-watchdog → Gemini Flash** (9th time proposing). 95%+ of runs are "CI green ✅" in 8-9s on Opus. This is the easiest cost savings in the fleet. The occasional fix runs could likely work on Flash too.

2. **Disable woodbrass-reply-check?** Still running every 4h on Flash, still finding nothing (2s runs). Cheap but pointless. Same proposal as last 3 audits.

3. **Consider disabling kinbot-e2e-tests** if next run still times out. Has been timing out for weeks. The kinbot-ci-watchdog already handles CI failures including E2E test breakages.

### Cost analysis
- 18 active KinBot crons, nearly all on Opus
- kinbot-memory-research is the heaviest consumer but also the most productive (shipped ~20 features to the memory system)
- kinbot-e2e-tests is pure waste if it keeps timing out (Opus tokens burned for zero output)
- kinbot-ci-watchdog on Opus for 9s "CI green" checks remains the easiest savings

### Next audit focus
- Verify kinbot-e2e-tests behavior with new 300s timeout
- Verify kinbot-promo works with 600s timeout
- Watch memory-research for repeated timeouts
- Check if kinbot-github-maintenance (349s on 300s timeout) is cutting it close — may need timeout bump

## 2026-03-12 12:09 UTC
### Audit summary
- **Active KinBot crons:** 18 (unchanged)
- **Non-KinBot active:** PinchChat, woodbrass-reply-check, reddit-token-refresh

### Healthy (productive, no issues)
- **kinbot-community** (8h, Opus) — 17s last run (nothing open). Working.
- **kinbot-add-tests** (8h, Opus, 900s) — 284s. Steady.
- **kinbot-plugin-improve** (8h, Opus) — 224s. Working.
- **kinbot-docs-content** (6h, Opus, 600s) — 66s. Working.
- **kinbot-memory-research** (12h, Opus, 600s) — 478s. Deep R&D.
- **kinbot-github-maintenance** (12h, Opus) — 253s. Working.
- **kinbot-improve-site** (12h, Opus, 600s) — 214s. Working.
- **kinbot-qa-explorer** (12h, Opus, 900s) — 308s. Finding bugs.
- **kinbot-release** (1x/day 17:00 UTC, Opus) — 215s. v0.19.2 shipped.
- **kinbot-promo** (1x/day 14:00 Paris, Opus) — 169s. Working.
- **kinbot-ci-watchdog** (6h, Opus) — 202s last run (fixed something). Usually 8s.
- **kinbot-improve-cli** (24h, Opus, 600s) — 145s. Working.
- **kinbot-sse-reactivity** (24h, Opus) — 277s. Working.
- **kinbot-i18n-audit** (48h, Opus) — 259s. Working.
- **kinbot-consistency-guardian** (48h, Opus) — 15s. Working.
- **reddit-token-refresh** (12h, Flash) — 1.7s. Minimal.
- **PinchChat** (2x/day, Opus) — 532s. Quality mode, still productive.

### Issues found & actions taken

1. **kinbot-e2e-tests: STILL timing out (3 consecutive, 900s each)** ⚠️
   - Previous audit reduced timeout and added warnings. But the 900s timeout from before was still in effect for the last 3 runs (timeout change happened after).
   - **Action:** Rewrote the prompt to be much shorter and more forceful. Added explicit allowlist of commands (git, cat, grep, gh, bun run build, bun test only). Removed all the detailed instructions that gave room for the agent to "just quickly check" by running Playwright. Timeout confirmed at 300s. Next run should be the real test.
   - If it STILL times out after this: consider disabling and folding E2E test maintenance into kinbot-ci-watchdog (which already fixes CI failures including E2E).

2. **woodbrass-reply-check: Still running, still nothing** — 4h on Flash, 1.4s. Cheap but pointless. Leaving it for Nicolas to decide.

### Proposals (for Nicolas to decide)

1. **Model downgrade: kinbot-ci-watchdog → Gemini Flash** (8th time proposing). 95%+ of runs are "CI green ✅" in 8s on Opus. The occasional fix runs (202s last) could likely work on Flash too. This is the easiest cost savings in the fleet.

2. **Disable woodbrass-reply-check?** — Has never found anything. Nicolas was asked before, no decision. Low priority since it's on Flash (pennies).

3. **Consider disabling kinbot-e2e-tests entirely** if the next run still times out. The kinbot-ci-watchdog already catches and fixes CI failures including E2E. Having a dedicated E2E cron that can't follow instructions is pure waste.

### Cost analysis
- 18 active KinBot crons, nearly all on Opus. The fleet is mature and productive.
- Main waste: kinbot-e2e-tests (3 runs x 900s timeout on Opus = significant cost for zero output)
- Secondary waste: kinbot-ci-watchdog on Opus for trivial checks (but occasionally fixes real issues)

### Next audit focus
- Verify kinbot-e2e-tests behaves with new prompt (300s timeout, shorter instructions)
- Watch for cron coordination issues (multiple crons editing same files)
- Check if any 12h crons could go to 24h without losing value

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
