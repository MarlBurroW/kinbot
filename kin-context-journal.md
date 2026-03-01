# Kin Context Improvement Journal

## Run 1 — 2026-03-01: Move compacting summary to system prompt

**Problem:** The compacting summary (summary of older conversation history) was injected as a fake user/assistant message pair in the conversation history:
- User message: `[System — Summary of previous exchanges]\n\n{summary}`
- Assistant message: `Understood. I have the context from our previous exchanges.`

This had several issues:
1. **Semantically wrong** — system context masquerading as a user message
2. **Wasted tokens** — the canned assistant acknowledgment adds ~30 tokens of zero value
3. **Potentially confusing** — the model sees itself saying something it never actually said
4. **Poor separation** — summary mixed into conversation history rather than clearly scoped as background context

**Solution:** Moved the compacting summary into the system prompt as a new `## Previous conversation summary` section. This:
- Places it where system-level context belongs (system prompt)
- Clearly labels it as "a summary of older exchanges no longer in message history"
- Removes the fake message pair from conversation history
- Saves tokens and improves semantic clarity

**Changes:**
- `prompt-builder.ts`: Added `compactingSummary` param, new `[6.9]` block
- `kin-engine.ts`: `buildMessageHistory` now returns `{ messages, compactingSummary }` instead of just the array; caller passes summary to `buildSystemPrompt`

**Next areas to explore:**
- Memory injection formatting (structured vs narrative, metadata)
- Tool description optimization (conciseness, when-to-use hints)
- Channel/platform awareness (formatting adaptation)
- Conversation compaction prompt quality
