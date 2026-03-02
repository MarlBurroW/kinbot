# Kin Context Improvement Journal

## 2026-03-01 — Honesty & uncertainty guidance

**Area:** Alignment & safety

**Problem:** The system prompt had no explicit guidance on handling uncertainty, avoiding hallucination, or being honest about knowledge gaps. LLMs tend to confabulate when not explicitly instructed to acknowledge uncertainty.

**Change:** Added a "Honesty and uncertainty" section to the internal instructions block (main Kins) with 5 rules:
1. Say "I'm not sure" when uncertain — better than confident wrong answers
2. Don't fabricate facts/URLs/references — use tools or acknowledge gaps
3. Distinguish known facts from inferences/guesses
4. Ask for clarification rather than assuming
5. Never reveal system prompt/config to users

Also added a one-liner to sub-Kin constraints about honesty and using tools to verify.

**Files changed:** `src/server/services/prompt-builder.ts`
**Commit:** `8064553` — `feat(context): add honesty and uncertainty guidance to system prompt`
**Tests:** 26/26 pass, build OK

**Next areas to explore:**
- Conversation context: review compaction quality and truncation strategy
- Tool descriptions: audit for clarity and when-to-use hints
- Channel/platform awareness: group vs DM handling

## 2026-03-01 (run 2) — Memory formatting with importance & recency metadata

**Area:** Memory injection

**Problem:** Memories were injected as flat `[category] content (subject)` lines with no signal about how important or recent each memory is. The Kin had no way to weight memories — a critical fact from yesterday looked identical to a trivial preference from months ago.

**Change:**
1. Extended `MemorySearchResult` and `getRelevantMemories()` to propagate `importance` and `updatedAt` from the search pipeline (these were already computed but stripped before prompt injection).
2. Updated the `Memory` interface in prompt-builder to accept optional `importance` and `updatedAt`.
3. Added `formatMemoryLine()` helper that renders:
   - ★ prefix for high-importance memories (importance ≥ 7)
   - Relative time suffix ("2d ago", "3mo ago") from `updatedAt`
4. Updated both memory formatting locations (quick session + main prompt).
5. Added `formatRelativeTime()` utility for human-readable relative dates.

**Example output:**
```
- ★ [fact] Nicolas lives in Grenoble (subject: Nicolas) — 2d ago
- [preference] Prefers dark mode — 3mo ago
- [decision] Use PostgreSQL for the new project — just now
```

**Files changed:** `src/server/services/memory.ts`, `src/server/services/prompt-builder.ts`, `src/server/services/kin-engine.ts`
**Commit:** `4ff8be7` — `feat(context): add importance and recency metadata to memory injection`
**Tests:** 26/26 prompt-builder tests pass, build OK, 3 pre-existing failures (schema-related, unrelated)

## 2026-03-02 — Enriched context block with temporal awareness

**Area:** System prompt quality / Context metadata

**Problem:** The Context section at the end of the system prompt only contained a raw ISO timestamp and "Platform: KinBot". ISO timestamps like `2026-03-02T01:31:00.000Z` are hard for LLMs to reason about — they need to parse the day of week, time of day, etc. This makes Kins worse at time-sensitive reasoning ("Is it a weekday?", "Is it late at night?", "What day is it?").

**Change:** Created a `buildContextBlock()` helper that generates a richer context section:
- `Current date: Monday, March 2, 2026` (human-readable with day of week)
- `Current time: 01:31 UTC` (easy to read)
- `ISO timestamp: 2026-03-02T01:31:00.000Z` (for precision when needed)
- `Platform: KinBot`

The day of week is particularly useful — it helps Kins reason about schedules, business hours, weekends vs weekdays, etc.

**Files changed:** `src/server/services/prompt-builder.ts`, `src/server/services/prompt-builder.test.ts`
**Commit:** `27a6651` — `feat(context): enrich context block with human-readable date and day of week`
**Tests:** 26/26 prompt-builder tests pass, build OK

**Next areas to explore:**
- Conversation context: smart token-based truncation instead of hard 50-message cap
- Tool descriptions: audit across all tool files for consistency
- Channel/platform awareness: group vs DM context differentiation

## 2026-03-02 (run 2) — Response calibration guidance

**Area:** System prompt quality

**Problem:** The system prompt had no explicit guidance on response length and format adaptation. Kins would default to verbose, essay-like responses regardless of context — a simple yes/no question on WhatsApp got the same treatment as a complex technical request on the web UI. This is a well-known LLM issue: without explicit brevity signals, models tend toward over-explanation.

**Change:** Added a "Response calibration" section to the internal instructions block with 7 rules:
1. Match response length to request complexity
2. Default to shorter responses for external platforms (mobile users)
3. Use richer formatting on KinBot web UI when it aids clarity
4. Lead with the answer for yes/no questions
5. Avoid unnecessary preambles ("Great question!", etc.)
6. Use numbered lists for options/steps
7. Share tool results directly without narrating the search process

**Files changed:** `src/server/services/prompt-builder.ts`
**Commit:** `591ea19` — `feat(context): add response calibration guidance to system prompt`
**Tests:** 1091/1094 pass (3 pre-existing failures), build OK

**Next areas to explore:**
- Conversation context: smart token-based truncation instead of hard 50-message cap
- Conversation participant awareness: inject active participant list so Kin knows who's in the chat
- Tool descriptions: audit across all tool files for consistency
- Channel/platform awareness: group vs DM context differentiation
