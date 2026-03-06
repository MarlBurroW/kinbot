---
title: How Memory Works
description: Understanding KinBot's dual-channel memory system.
---

KinBot gives each Kin persistent memory across conversations. The system uses two complementary channels: **automatic extraction** and **explicit remembering**.

:::note
For Kin-specific memory features (importance, categories, retrieval), see [Kin Memory](/kinbot/docs/kins/memory/).
:::

## Dual-Channel Architecture

### Automatic Extraction

After every LLM turn, KinBot runs a memory extraction pipeline that identifies facts, preferences, decisions, and other memorable information from the conversation. These are stored automatically without any user action.

The extraction uses a dedicated model (configurable via `MEMORY_EXTRACTION_MODEL`) to analyze the conversation and produce structured memory entries with categories and importance scores.

### Explicit Remembering

Kins also have a `remember()` tool that lets them (or users) explicitly store information. This is useful for direct instructions like "Remember that I prefer dark mode" or important context the extraction pipeline might miss.

## Storage & Retrieval

Memories are stored as vector embeddings using an embedding provider (OpenAI, Voyage, Jina, etc.). When a new conversation starts, KinBot retrieves relevant memories using **hybrid search**:

1. **Vector similarity** — Cosine similarity between the current context and stored memory embeddings
2. **Full-text search** — Keyword matching for precise terms
3. **Ranking** — Results are combined and ranked by relevance and importance

Retrieved memories are injected into the Kin's context, giving it awareness of past interactions without needing to replay entire conversation histories.

## Session Compacting

When conversations grow long, KinBot automatically **compacts** them:

1. The conversation reaches a threshold (message count or token count)
2. A summarization model distills the conversation into a compact snapshot
3. The snapshot replaces the full history, preserving context while reducing token usage
4. Multiple snapshots are kept (up to `COMPACTING_MAX_SNAPSHOTS`) for layered context

This ensures Kins can maintain context in very long conversations without hitting token limits.

## Data Flow

```
User message
  → LLM processes with injected relevant memories
  → LLM responds
  → Extraction pipeline analyzes the turn
  → New memories stored as embeddings
  → Available for future retrieval
```
