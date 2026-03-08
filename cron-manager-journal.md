# KinBot Cron Manager Journal

## 2026-03-06 13:01 UTC
### Audit summary
- **Active KinBot crons:** 18 (+ non-KinBot: PinchChat, woodbrass-reply-check, reddit-token-refresh, bot-chronicles)
- **One-shot pending:** HN Show HN launch at 14:00 UTC today

### Healthy (productive, no issues)
- **kinbot-memory-research** (3h, Opus) — Incredibly productive. Shipped contextual query rewriting, importance/age enrichment, embedding dimension bump (768→1536), review_memories tool. R&D quality is excellent.
- **kinbot-add-tests** (2h, Opus, 900s timeout) — Steady test coverage growth. Now at 2000+ tests. Good mix of unit tests across providers, services, tools.
- **kinbot-docs-site** (2h, Opus) — Massive progress. Full Starlight docs site scaffolded, all sections migrated (plugins, mini-apps, kins, channels, memory, providers, API). Docs link added to landing page. Phase 2 complete.
- **kinbot-plugin-improve** (2h, Opus) — All 8 store plugins complete (weather, rss, system-monitor, pomodoro, bookmarks, github-notifications, home-automation, calendar). Plugin system feature-complete.
- **kinbot-release** (3x/day, Opus) — v0.13.0 shipped. Clean workflow.
- **kinbot-ci-watchdog** (3h, Opus) — CI green ✅. Still mostly 8s runs.
- **kinbot-promo** (4x/day, Opus) — Active on GitHub (awesome list PRs), Reddit, and Twitter. Reddit API intermittent but falls back.
- **kinbot-qa-explorer** (4h, Opus, 900s) — Filed real bugs (#61, #62, #71-#76). Finding actionable issues.
- **kinbot-e2e-tests** (6h, Opus, 600s) — Fixing real E2E failures. Good interval.
- **kinbot-improve-cli** (6h, Opus) — Added `--cron` auto-update scheduling. Productive.
- **kinbot-github-maintenance** (4h, Opus) — GitHub Discussions enabled, FUNDING.yml, community section. Good hygiene.
- **kinbot-improve-site** (4h, Opus) — Tech Stack section, Plugin Store showcase. Good.
- **kinbot-i18n-audit** (12h, Opus) — Appropriate interval.
- **kinbot-sse-reactivity** (12h, Opus) — Appropriate interval.
- **kinbot-consistency-guardian** (12h, Opus) — Refactoring work. Appropriate.
- **kinbot-community** (4h, Opus) — Implemented #71 (model picker fix), #73, #74, #76 (cron UI fixes). Very productive when issues exist.

### Issues found & actions taken

1. **kinbot-community: self-PR-approval STILL happening** (3rd time fixing)
   - **Problem:** Despite previous prompt fixes, the cron still tried `gh pr review --approve` which always fails with "Can not approve your own pull request". Seen in runs from Mar 5.
   - **Action:** Rewrote the PR handling section to be more explicit: "**NEVER use `gh pr review --approve`**" with clear alternative instructions. The previous wording "Do NOT try to approve PRs" was apparently not strong enough.

2. **`.marlbot-context.md` STILL MISSING** (5th audit noting this)
   - Multiple crons show `cat .marlbot-context.md: No such file or directory`
   - This is now a **critical recurring gap**. Every KinBot cron references it.
   - **Proposal:** Nicolas needs to either recreate it or acknowledge it's gone and we remove references from all prompts.

3. **API rate limiting hitting multiple crons**
   - Between ~10:00-12:00 UTC on Mar 6, several crons reported "API rate limit reached" (add-tests, promo, plugin-improve, ci-watchdog, memory-research, docs-site, qa-explorer)
   - This happens when too many Opus crons run simultaneously
   - Not critical (they recover next run) but wastes cycles

### Actions taken
- **Fixed kinbot-community prompt** — Strengthened PR approval prohibition from "Do NOT try to approve" to "**NEVER use `gh pr review --approve`**" with explicit explanation

### Proposals (for Nicolas to decide)

1. **`.marlbot-context.md` recreation** — **CRITICAL** (5th time proposing). Either recreate it or remove all references from cron prompts.

2. **Model downgrade: kinbot-ci-watchdog** → Gemini Flash (4th time proposing). 95%+ runs are "CI green ✅" in 8s on Opus.

3. **Rate limit mitigation** — With 18+ active KinBot crons on Opus, simultaneous runs cause rate limiting. Options:
   - Stagger cron schedules to avoid simultaneous execution
   - Downgrade trivial crons to cheaper models (ci-watchdog, reddit-token-refresh already on Flash)
   - Accept it (crons recover naturally)

### Cost analysis
- 30 commits in last 24h. Excellent productivity.
- v0.13.0 released with major features (plugins, docs site, memory improvements)
- Docs-site cron delivering exceptional value — full documentation site in 2 days
- HN Show HN launch scheduled for 14:00 UTC today — good timing after docs site completion

### Next audit focus
- Monitor HN Show HN post results
- Check if `.marlbot-context.md` gets recreated
- Verify kinbot-community no longer tries PR approval
- Monitor rate limiting patterns

## 2026-03-06 07:14 UTC
### Audit summary
- **Gateway timeout** — cron list/runs API timed out twice (60s). Could not pull live cron status or run histories this audit. Assessment based on git log and previous journal state.
- **27 commits since last audit** (18h ago) — ecosystem extremely productive
- **v0.12.0 released** (cd519ee)

### Productivity by cron (inferred from commits)
- **kinbot-memory-research** — contextual query rewriting, importance/age enrichment, embedding dimension bump (768→1536). 3 commits. Excellent.
- **kinbot-mini-apps** — Kanban board, DateRangePicker. 2 commits. Still the star.
- **kinbot-add-tests** — contact-tools, database-tools, settings routes, prompt-builder helpers, fixed 11 failing tests. 5 commits. Very productive.
- **kinbot-docs-site** — Scaffolded Starlight docs, migrated Getting Started + Plugins sections. 3 commits. New cron delivering immediately.
- **kinbot-improve-site** — Tech Stack section, Plugin Store showcase. 2 commits.
- **kinbot-improve-cli** — Config wizard expansion. 1 commit.
- **kinbot-plugin-improve** — plugin management tools (#68), github-notifications plugin, bookmarks plugin, system-monitor plugin. 4 commits. Very productive.
- **kinbot-qa-explorer** — Closed #71 (model picker fix), #73, #74, #76 (cron UI fixes). 3 commits fixing real issues.
- **kinbot-e2e-tests** — Fixed mini-app gallery E2E test. 1 commit.
- **kinbot-release** — v0.12.0 shipped. 1 commit.
- **kinbot-community** — Likely handled some issue closures (can't confirm without run data).

### Issues found
1. **Gateway timeout on cron API** — Both cron list attempts failed with 60s timeout. This is unusual and may indicate gateway load or a stuck cron operation. Worth monitoring — if it persists, may need a gateway restart.
2. **`.marlbot-context.md` still missing** — 4th audit noting this. Every KinBot cron references it. This is now a recurring proposal that needs Nicolas's attention.
3. **kinbot-community self-PR-approval** — Still not fixed in prompt (proposed last audit). Low priority but wastes a tool call per PR.

### Actions taken
- **None** — could not access cron API to make changes. Ecosystem is healthy based on git output. No action needed.

### Proposals (carried forward + new)
1. **`.marlbot-context.md` recreation** — URGENT (4th time proposing). Have a cron generate it or have Nicolas create it manually.
2. **Model downgrade: kinbot-ci-watchdog** → Gemini Flash (3rd time proposing). 95%+ runs are trivial "CI green" checks.
3. **kinbot-community prompt fix** — Remove self-PR-approval attempts.
4. **NEW: Gateway health** — If cron API timeouts persist, investigate gateway load. 19+ active crons on Opus may be straining the scheduler.

### Cost analysis
- 27 commits in 18h = ~1.5 commits/hour. Excellent ROI.
- No evidence of wasted cycles from git log (no revert commits, no duplicate work).
- Docs-site cron delivering immediately — good investment.

### Next audit focus
- Retry cron API access — if still timing out, flag for Nicolas
- Check if `.marlbot-context.md` was created
- Verify kinbot-plugin-improve is not creating conflicts with store plugins
- Monitor docs-site for Pages workflow success

## 2026-03-05 13:01 UTC
### Audit summary
- **Active KinBot crons:** 19 (+ 3 non-KinBot: PinchChat, woodbrass-reply-check, reddit-token-refresh, bot-chronicles, HN Show HN one-shot)
- **New since last audit:** `kinbot-docs-site` (2h, Opus) created today

[...previous entries truncated for brevity...]

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

## 2026-03-08 07:00 UTC
### Audit summary
- **Active KinBot crons:** 19 (+ 4 non-KinBot: PinchChat, woodbrass-reply-check, reddit-token-refresh, bot-chronicles)
- **New since last audit:** `kinbot-teams` (2h, Opus, feat/teams branch) — Phase 1 done, Phase 2 in progress

### Healthy (productive, no issues)
- **kinbot-add-tests** (2h, Opus, 900s) — Very productive. Adding tests across multiple spec files. 188-465s runs.
- **kinbot-plugin-improve** (2h, Opus) — Steady. Plugin dependency management, version compat. 333s runs.
- **kinbot-community** (1h, Opus, 600s) — Quick runs (~12s when nothing open). Responsive.
- **kinbot-ci-watchdog** (3h, Opus) — Fast 8s "CI green" checks. Working perfectly.
- **kinbot-memory-research** (3h, Opus, 600s) — Deep R&D. Query intent detection implemented. 255s runs.
- **kinbot-github-maintenance** (4h, Opus) — Good hygiene. 162s runs.
- **kinbot-improve-site** (4h, Opus, 600s) — Landing page polish. 188s runs.
- **kinbot-qa-explorer** (4h, Opus, 900s) — Finding real bugs, creating issues. 176s runs.
- **kinbot-promo** (4x/day, Opus) — Active on GitHub, Reddit. 132s runs.
- **kinbot-release** (3x/day, Opus) — v0.14+ shipping. 205s runs.
- **kinbot-improve-cli** (6h, Opus, 600s) — CLI installer improvements. 340s runs.
- **kinbot-docs-content** (6h, Opus, 600s) — Docs accuracy reviews. 96s runs.
- **kinbot-sse-reactivity** (12h, Opus) — SSE event fixes. 180s runs.
- **kinbot-teams** (2h, Opus, 900s) — NEW. Phase 1 (schema+CRUD) done in first run, Phase 2 (frontend) in progress. 462-562s runs.

### Issues found & actions taken

1. **kinbot-i18n-audit: NOTHING TO FIX for 20+ consecutive runs** ⚠️
   - Every single run says "i18n is in excellent shape, nothing to fix". The codebase has 1200+ keys perfectly synced.
   - Was running every 12h on Opus, burning tokens for "no changes needed" reports.
   - **Action: Changed interval from 12h to 48h.** i18n only needs checking after significant feature batches land.

2. **kinbot-consistency-guardian: NOTHING TO FIX for 10+ consecutive runs** ⚠️
   - Keeps auditing all 5 focus areas and finding "codebase is well-factored, nothing to extract". Occasionally finds minor things.
   - Was running every 12h on Opus.
   - **Action: Changed interval from 12h to 48h.** Same rationale — only useful after significant new code lands.

3. **kinbot-e2e-tests: FREQUENT TIMEOUTS at 600s** ⚠️
   - ~40% of runs timeout. When it works, runs take 150-520s. But Playwright operations are slow and the agent sometimes runs the full suite despite being told not to.
   - **Action: Increased timeout from 600s to 900s.** Prompt already says not to run full suite, but extra buffer helps.

### Proposals (for Nicolas to decide)

1. **Model downgrade: kinbot-ci-watchdog** → Gemini Flash (7th time proposing). 95%+ runs are "CI is green" in 8s. Opus is massive overkill.

2. **Model downgrade: kinbot-i18n-audit** → Gemini Flash. When it does find something, it's simple string replacements. Doesn't need Opus reasoning.

3. **Model downgrade: kinbot-consistency-guardian** → Gemini Flash. Mostly grep + pattern matching. Doesn't need Opus.

4. **`.marlbot-context.md` still missing** (7th time noting). Every KinBot cron references it in its prompt.

5. **kinbot-teams using 900s timeout** — The 562s Phase 2 run suggests this is appropriate, but monitor. If it consistently finishes under 300s once the feature stabilizes, reduce.

### Cost analysis
- 19 active KinBot crons on Opus = significant daily cost
- i18n-audit + consistency-guardian were burning ~4 Opus runs/day combined for zero output. Now reduced to ~1 run/2 days each. Saves ~3.5 Opus runs/day.
- kinbot-community runs complete in 12s most of the time (nothing to do). Could also benefit from model downgrade when idle.

### Next audit focus
- Monitor kinbot-teams for timeout issues as Phase 2 progresses
- Check if kinbot-e2e-tests stops timing out with 900s
- Verify i18n and consistency at 48h interval still catch issues when features land
- Push harder on ci-watchdog model downgrade — it's the most obvious cost saving
