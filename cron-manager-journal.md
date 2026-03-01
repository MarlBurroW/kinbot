# KinBot Cron Manager Journal

## 2026-03-01 21:02 UTC — First Audit

### Audit summary
- **Active crons:** 20 (16 KinBot + PinchChat + bot-chronicles + reddit-token-refresh + this manager)
- **Disabled crons:** 18 (Twitter, email, infra, moltbook, DCA, TS bot, branding, promo, memory-smart, etc.)

### Healthy crons (working well)
- **kinbot-ci-watchdog** — fast (9s), runs hourly, does its job well. ✅
- **kinbot-add-tests** — every 2h, 78s avg, 0 errors. ✅
- **kinbot-channel-files** — every 1h, 204s avg, healthy. ✅
- **kinbot-i18n-audit** — every 2h, 144s avg, healthy. ✅
- **kinbot-mini-apps** — every 2h, 262s avg, healthy. ✅
- **kinbot-frontend-perf** — every 2h, 158s avg, healthy. ✅
- **kinbot-memory-research** — every 3h, 218s avg, healthy. ✅
- **kinbot-community** — every 2h, 449s avg (long but productive), healthy. ✅
- **kinbot-release** — 3x/day cron, 126s avg, healthy. ✅
- **kinbot-sse-reactivity** — every 2h, mostly OK (1 timeout). ✅
- **PinchChat** — 2x/day, 421s avg, healthy. ✅
- **bot-chronicles-daily** — 1x/day, healthy. ✅
- **reddit-token-refresh** — every 12h, Gemini Flash, cheap. ✅

### Issues found & actions taken

#### 1. CRITICAL: Resource contention causing cascading timeouts
**Root cause:** 5 hourly + 8 bi-hourly Opus crons = up to ~10 concurrent Opus sessions at peak. This causes timeouts across multiple crons.

**Actions taken:**
- **kinbot-e2e-tests**: 1h → **3h** (was timing out 13x in a row at 600s; also had port 3334 conflicts from overlapping runs)
- **kinbot-consistency-guardian**: 2h → **12h** (codebase is clean per multiple recent audits saying "nothing to extract")
- **kinbot-github-maintenance**: 1h → **4h** (was timing out 4x in a row; keeps checking for same files that don't exist)
- **kinbot-improve-cli**: 2h → **6h** (installer is 3500+ lines and very mature; diminishing returns)
- **kinbot-improve-site**: 1h → **3h** (reduce hourly pressure)

#### 2. kinbot-kin-context timeout fix
- Timeout increased 300s → **600s** (was timing out at 300s; prompt-builder code analysis needs more time)

#### 3. kinbot-consistency-guardian — doing nothing useful
Recent runs show: "codebase is clean", "no actionable duplicates", "nothing to extract" repeatedly. Moved to 12h to just do periodic sanity checks instead of wasting Opus tokens every 2h.

#### 4. kinbot-github-maintenance — stuck in loop
Keeps checking for CODE_OF_CONDUCT.md, PR templates, linting configs that either exist or don't. Same grep patterns failing every run. The 4h schedule will reduce waste. May need prompt refinement if it continues looping.

### Post-adjustment cron load estimate
**Hourly peak (worst case):**
- Before: ~10 concurrent Opus sessions
- After: ~5-6 concurrent Opus sessions (much healthier)

**Daily Opus runs:**
- Before: ~168 runs/day
- After: ~92 runs/day (~45% reduction)

### Proposals (for Nicolas to decide)

1. **Merge kinbot-github-maintenance into kinbot-ci-watchdog**: The CI watchdog already checks CI status. GitHub maintenance (README, templates, etc.) is mature enough to not need a dedicated hourly cron. Could fold the "if CI green, do one repo hygiene task" into the watchdog.

2. **Consider cheaper models for simple crons**: kinbot-ci-watchdog (just checks `gh run list`) and reddit-token-refresh could use Gemini Flash. The watchdog already finishes in 10s on Opus, which is overkill.

3. **Disable kinbot-consistency-guardian entirely?**: The codebase is well-factored. This cron has been finding nothing for days. Could re-enable when a big feature wave lands.

4. **New cron: kinbot-bug-squasher**: A cron focused on finding and fixing actual bugs (TypeScript strict mode violations, runtime edge cases, error handling gaps). Several crons noted TS errors on main that nobody is fixing specifically.

### Next audit focus
- Check if the period adjustments resolved the timeout cascade
- Monitor kinbot-e2e-tests (13 consecutive errors, needs attention even with longer period)
- Check if kinbot-github-maintenance breaks out of its loop pattern
- Review kinbot-community run durations (449s is close to the limit)
