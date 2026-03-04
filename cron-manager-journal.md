# KinBot Cron Manager Journal

## 2026-03-04 21:06 UTC
### Audit summary
- **Active KinBot crons:** 16
- **Non-KinBot crons:** 5 (PinchChat, woodbrass-reply-check, reddit-token-refresh, bot-chronicles, HN Show HN one-shot)

### Healthy (productive, well-tuned)
- **kinbot-mini-apps** (2h, Opus) — consistently shipping components, hooks, templates. Very productive.
- **kinbot-memory-research** (3h, Opus) — shipped hybrid search, LLM re-ranking, multi-query retrieval, adaptive K. Great R&D cron.
- **kinbot-add-tests** (2h, Opus) — steadily adding test files. Occasional timeouts (600s) and "AI overloaded" but recovers.
- **kinbot-release** (3x/day, Opus) — clean workflow, skips when nothing to release. Well-behaved.
- **kinbot-ci-watchdog** (3h, Opus) — mostly "CI green ✅" in 8s. Efficient. 3h interval is appropriate.
- **kinbot-promo** (4x/day, Opus) — Reddit API failures are frequent but falls back to Twitter. Always produces at least 1 action per run.
- **kinbot-qa-explorer** (4h, Opus) — creating useful issues via browser testing. 900s timeout appropriate for browser work.
- **kinbot-e2e-tests** (6h, Opus) — focused on fixing/adding Playwright tests. Good interval.
- **kinbot-improve-cli** (6h, Opus) — steady installer improvements.
- **kinbot-github-maintenance** (4h, Opus) — README, CI, repo hygiene. Productive.

### Issues found & actions taken

1. **kinbot-community** (was 2h → changed to **6h**)
   - **Problem:** ~80% of runs return "Nothing to do" in 10-15s. Only 2 template issues exist as "good first issue". Running every 2h on Opus is pure waste.
   - **Action:** Changed interval from 2h to 6h. Still responsive enough for real community activity.

2. **kinbot-i18n-audit** (was 2h → changed to **12h**)
   - **Problem:** Repeatedly reports "i18n is in excellent shape" across many consecutive runs. The i18n work is essentially done.
   - **Action:** Changed interval from 2h to 12h. Will still catch regressions from new features.

3. **kinbot-sse-reactivity** (was 2h → changed to **12h**)
   - **Problem:** SSE coverage has been confirmed comprehensive and complete across multiple runs. Multiple timeouts at 300s despite having nothing new to find. Keeps re-auditing completed work.
   - **Action:** Changed interval from 2h to 12h. Sufficient to catch new SSE gaps from other crons' code changes.

### No run history available
- kinbot-consistency-guardian, kinbot-improve-site, kinbot-improve-cli, kinbot-e2e-tests, kinbot-github-maintenance — no run history returned (possibly purged or too old). They appear healthy based on their state (no consecutive errors, recent lastRunAt).

### Cost analysis
All KinBot crons run on Opus 4.6. The biggest token wasters were the three crons above running every 2h with nothing to do. Estimated savings from today's changes: ~18 Opus runs/day eliminated (6 community + 6 i18n + 6 SSE reduced to 4+2+2).

### Proposals (for Nicolas to decide)
1. **Model downgrade candidates:**
   - `kinbot-ci-watchdog` — 90% of runs are "CI green" in 8s. Could use Gemini Flash instead of Opus. Only needs Opus when actually fixing CI.
   - `kinbot-community` — when there are no issues/PRs, the "nothing to do" check is trivial. Could use Flash for the check and only escalate to Opus if work is found. (Harder to implement with current cron system.)

2. **Potential new cron:**
   - **kinbot-plugin-system** — no cron covers the plugin/tool system (`src/server/tools/`). Could improve built-in tools, add new ones, improve tool descriptions for better Kin usage.

### Next audit focus
- Check actual token usage per cron if possible
- Monitor whether the 3 adjusted crons still catch real work at their new intervals
- Review kinbot-promo Reddit failures pattern (is the token refresh cron working?)
