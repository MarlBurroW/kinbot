---
title: Kin Memory
description: How Kins remember and learn across conversations.
---

KinBot gives every Kin **persistent long-term memory** — a dual-channel system that combines automatic extraction with explicit storage, searchable via hybrid vector + full-text search.

## How it works

### Automatic extraction

After every LLM turn, KinBot runs an **extraction pipeline** that identifies important information from the conversation and saves it as memories. This happens silently in the background — the Kin doesn't need to do anything.

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
| `recall` | Search memories (semantic + keyword) |
| `memorize` | Save new information |
| `update_memory` | Update an existing memory |
| `forget` | Delete a memory |
| `list_memories` | Browse memories by category |
| `search_history` | Search conversation message history |

## Session compacting

When a conversation grows beyond the model's context window, KinBot **compacts** older messages into a summary. Key points:

- Original messages are **never deleted** — they're preserved in the database
- The compacting summary is injected at the start of the context window
- Compacting is **rollback-able** — you can restore the original messages
- The Kin is informed about compacting: it knows how many messages are visible vs. total, and whether older history was compacted

## Memory and privacy

- Memories are per-Kin — each Kin has its own memory store
- Vault secrets are **never** stored in memories (redaction prevents leaking into compacted summaries)
- Memory search respects the Kin boundary — a Kin cannot access another Kin's memories
