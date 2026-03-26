---
title: Kin Memory
description: How Kins remember and learn across conversations.
---

KinBot gives every Kin **persistent long-term memory** — a dual-channel system that combines automatic extraction with explicit storage, searchable via hybrid vector + full-text search.

## How it works

### Automatic extraction

After every LLM turn, KinBot runs an **extraction pipeline** that identifies important information from the conversation and saves it as memories. This happens silently in the background — the Kin doesn't need to do anything.

Each extracted memory includes a **source context** — a brief description of the conversational context in which the fact was mentioned (e.g. *"While discussing weekend plans, user mentioned..."*). This gives memories episodic flavor, helping the Kin understand not just *what* was said but *when and why*.

### Explicit memorization

Kins can also deliberately save information using the `memorize` tool:

```
memorize("Nicolas prefers dark mode and French responses", category: "preference", subject: "Nicolas")
```

### Memory categories

Each memory has a category:

| Category | Use case |
|---|---|
| `fact` | Objective information (names, dates, technical details) |
| `preference` | User preferences and habits |
| `decision` | Decisions that were made and their rationale |
| `knowledge` | Learned domain knowledge |

### Importance scoring

Memories have an importance score from 1-10. Higher-importance memories are prioritized during retrieval. The automatic pipeline and the Kin can both set importance.

## Retrieval

Before each LLM turn, KinBot:

1. Takes the current user message
2. Optionally rewrites the query using recent conversation context for better semantic matching
3. Searches memories using **hybrid search**: vector similarity (embeddings) + full-text keyword matching (FTS5)
4. Injects the most relevant memories into the system prompt

This means the Kin always has relevant context without needing to explicitly recall information.

### Manual recall

Kins can also search memory explicitly:

- `recall("Nicolas's infrastructure setup")` — semantic + keyword search
- `list_memories(category: "decision")` — browse by category
- `search_history("kubernetes deployment")` — search past conversation messages

## Memory tools

| Tool | Purpose |
|---|---|
| `recall` | Search memories (semantic + keyword, includes shared) |
| `memorize` | Save new information (private or shared) |
| `update_memory` | Update an existing memory (content, category, scope) |
| `forget` | Delete a memory |
| `list_memories` | Browse memories by category or scope |
| `review_memories` | LLM-powered audit for contradictions, duplicates, stale entries |
| `search_history` | Search conversation message history |

## Shared memories

Memories default to **private** (only the owning Kin can see them), but Kins can mark memories as **shared** to make them searchable by all other Kins. This is useful for cross-domain facts like infrastructure details, user-wide preferences, or organizational decisions.

- Use `memorize(..., scope: "shared")` or `update_memory(..., scope: "shared")`
- `recall` automatically searches both private and shared memories
- Shared memories include author attribution (e.g. *[shared by Assistant]*)

## Session compacting

When context usage exceeds the threshold (default: 75% of the model's context window), KinBot **compacts** older messages into dated summaries. Key points:

- Original messages are **never deleted** — they're preserved in the database
- Summaries **accumulate chronologically** — each compaction creates a new summary, not a single overwritten snapshot
- When summaries exceed the budget, the oldest merge **telescopically** into higher-level summaries
- Compacting is configurable **per-Kin** (threshold, keep window, summary budget, max summaries, model)
- Users can **force compact** from the Kin's settings at any time

## Memory and privacy

- Memories are **per-Kin** by default — each Kin has its own memory store
- **Shared** memories are readable by all Kins but still owned by the creator
- Vault secrets are **never** stored in memories (redaction prevents leaking into compacted summaries)
