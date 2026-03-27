# KinBot Cron Manager Journal

## 2026-03-24 13:05 UTC
### Audit summary
- **Active crons:** 16 KinBot + 2 other (PinchChat, reddit-token-refresh)
- **Disabled crons:** 25

### Healthy crons (no changes needed)
- **kinbot-promo** (daily 14:00, Opus) -- ok, 286s
- **kinbot-community** (daily, Opus) -- ok, 103s
- **kinbot-docs-content** (6h, Opus) -- ok, 34s
- **kinbot-release** (daily 17:00, Opus) -- ok, 211s
- **kinbot-plugin-improve** (8h, Opus) -- ok, 223s
- **kinbot-memory-research** (12h, Opus) -- ok, 120s
- **kinbot-github-maintenance** (12h, Opus) -- ok, 298s
- **kinbot-improve-site** (12h, Opus) -- ok, 85s
- **kinbot-qa-explorer** (12h, Opus) -- ok, 163s
- **kinbot-improve-cli** (daily, Opus) -- ok, 224s
- **kinbot-sse-reactivity** (daily, Opus) -- ok, 283s
- **kinbot-i18n-audit** (2 days, Opus) -- ok, 285s
- **kinbot-consistency-guardian** (2 days, Opus) -- ok, 130s
- **reddit-token-refresh** (12h, Flash) -- ok, 1.6s

### Issues found

1. **kinbot-add-tests** -- Last run took 700s (timeout is 900s). Multiple timeouts in recent history (6+ over past weeks). Test suite now 3000+ tests, runs getting heavier. The cron spends a lot of time running `bun test` and `bun run build`. Some runs produce zero output ("AI overloaded" or rate limited). Borderline but still functional.

2. **kinbot-ci-watchdog** -- Last run 207s (timeout 300s). When CI is broken it does heavy work (read logs, fix code, build, test, push). When green it finishes in 8-14s. Timeout is fine for now but tight on fix runs.

3. **kinbot-e2e-tests** -- Disabled, 3 consecutive 900s timeouts. Agent keeps running Playwright locally despite explicit "DO NOT RUN PLAYWRIGHT" instruction. Correct decision to keep disabled.

4. **PinchChat** -- Feature-complete, codebase "in excellent shape". Last 10+ runs: "nothing to do", quality audits finding nothing. 3x/day on Opus is massive overkill. Many runs just scan code and say "all green, nothing actionable."

5. **kinbot-dynamic-platforms** -- Disabled, never run. Ready when Nicolas enables it.

### Actions taken
None. Everything is running acceptably. The kinbot-add-tests timeout situation is concerning but not broken yet.

### Standing proposals (for Nicolas to decide)
- **kinbot-ci-watchdog -> Gemini Flash** (15th time proposing). 95%+ runs are "CI green" in 8-14s on Opus. Massive cost savings potential.
- **PinchChat frequency reduction** -- 3x/day Opus for a project with "nothing to do" 80%+ of runs. Suggest 1x/day or even every 2 days. The project is stable at v1.71.0 with 320 tests, 0 lint errors, and no open issues.
- **kinbot-add-tests timeout** -- Monitor. If timeouts become more frequent, may need to split into "fix tests" vs "add tests" runs, or increase timeout beyond 900s.

### Next audit focus
- Monitor kinbot-add-tests for more timeouts
- Check if kinbot-dynamic-platforms gets enabled
- Continue monitoring PinchChat for wasted cycles
