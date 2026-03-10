---
title: How Memory Works
description: Understanding KinBot's memory system — extraction, retrieval, and the advanced search pipeline.
---

KinBot gives each Kin persistent memory across conversations. The system uses two complementary channels: **automatic extraction** and **explicit remembering**, backed by a sophisticated hybrid search pipeline.

:::note
For Kin-specific memory features (importance, categories, retrieval), see [Kin Memory](/kinbot/docs/kins/memory/).
:::

## Dual-Channel Architecture

### Automatic Extraction

After every LLM turn, KinBot runs a memory extraction pipeline that identifies facts, preferences, decisions, and knowledge from the conversation. These are stored automatically without any user action.

The extraction uses a dedicated model (configurable via `MEMORY_EXTRACTION_MODEL`) to analyze the conversation and produce structured memory entries with:

- **Category** — `fact`, `preference`, `decision`, or `knowledge`
- **Subject** — Who or what the memory is about (e.g. a contact name)
- **Source context** — A brief 1-2 sentence description of the conversational context in which the fact was mentioned (e.g. *"While discussing weekend plans, user mentioned..."*). This gives memories episodic flavor without a separate memory system.
- **Importance** — Score from 1 (mundane) to 10 (critical)

### Explicit Remembering

Kins have a `memorize` tool that lets them (or users) explicitly store information. This is useful for direct instructions like "Remember that I prefer dark mode" or important context the extraction pipeline might miss.

## Memory Tools

Kins have six memory tools available (main agent only):

| Tool | Description |
|------|-------------|
| `recall` | Semantic + keyword search across all memories |
| `memorize` | Explicitly save a new memory |
| `update_memory` | Update an existing memory's content, category, or subject |
| `forget` | Delete an outdated or incorrect memory |
| `list_memories` | List all memories, optionally filtered by subject or category |
| `review_memories` | LLM-powered audit that detects contradictions, duplicates, stale entries, and clutter |

## Storage

Memories are stored as vector embeddings using an embedding provider (OpenAI, Voyage, Jina, etc.) in a SQLite database with two search indexes:

- **sqlite-vec** — KNN vector index for semantic similarity
- **FTS5** — Full-text search index for keyword matching

## Retrieval Pipeline

When a Kin needs relevant memories (either via the `recall` tool or automatic injection at conversation start), KinBot runs a multi-stage pipeline:

### 1. Contextual Query Rewriting

Short or ambiguous messages (e.g. "yes", "what about that?") are rewritten into standalone queries using recent conversation context. This prevents poor retrieval on follow-up messages that only make sense in context.

Controlled by `MEMORY_CONTEXTUAL_REWRITE_MODEL` — disabled by default.

### 2. Multi-Query Expansion

If enabled, the query is expanded into 3 alternative formulations using an LLM. Each variation targets a different aspect, entity, or sub-topic to maximize recall. The system provides known memory subjects to help generate targeted, entity-specific queries.

Controlled by `MEMORY_MULTI_QUERY_MODEL` — disabled by default.

### 3. Hybrid Search (Vector + FTS)

For each query (original + variations), two searches run in parallel:

- **Vector similarity** — KNN search via sqlite-vec, filtered by a cosine similarity threshold
- **Full-text search** — FTS5 with prefix matching, AND-first with OR fallback

### 4. Reciprocal Rank Fusion (RRF)

Results from both search methods (across all query variations) are merged using RRF scoring:

```
score = Σ (boost / (K + rank + 1))
```

Where `K` is a smoothing constant (default 60) and FTS results get an optional boost factor (default 1.2×).

### 5. Score Weighting

Fused scores are weighted by multiple factors:

- **Temporal decay** — Older memories decay based on category. Facts/knowledge decay very slowly; decisions decay faster. Controlled by `MEMORY_TEMPORAL_DECAY_LAMBDA`.
- **Importance** — Higher importance memories get proportionally higher scores
- **Retrieval frequency** — Memories retrieved more often get a mild logarithmic boost (the system finds them useful)
- **Subject matching** — If the query mentions a known memory subject, those memories get a boost (default 1.3×)

### 6. LLM Re-ranking (Optional)

If enabled, the top candidates are sent to an LLM that scores each memory's relevance on a 0-10 scale. The LLM score becomes the primary ranking signal, with the hybrid score as a tiebreaker.

Controlled by `MEMORY_RERANK_MODEL` — disabled by default.

### 7. Adaptive K

Instead of returning a fixed number of results, Adaptive K trims the result list based on score distribution:

- Results below a minimum score ratio of the top result are dropped
- If there's a steep score drop between consecutive results (a "cliff"), the list is truncated there

This ensures only genuinely relevant memories are injected, avoiding noise. Enabled by default.

## Retrieval Tracking

Every time memories are injected into a Kin's context, their retrieval count and timestamp are updated. This data feeds into:

- **Retrieval frequency boost** during search scoring
- **Importance recalibration** — a periodic process that nudges importance scores based on retrieval patterns (frequently retrieved = bump up, never retrieved after 30+ days = slight decrease)

## Memory Consolidation

When enabled, KinBot periodically consolidates similar memories to reduce redundancy:

1. **Pair detection** — memories with cosine similarity above the threshold (default `0.85`) are flagged as candidates
2. **Clustering** — overlapping pairs are grouped into clusters, capped at **3 memories per cluster** to avoid information loss in large merges (larger clusters are split and handled across multiple runs)
3. **LLM merge** — each cluster is sent to an LLM that either merges them into a single richer memory or **aborts** if the memories are about genuinely different topics (preventing false merges)
4. **Quality guardrails** — the LLM preserves all unique details, picks the most appropriate category/subject, and keeps the highest importance rating from the sources

Consolidation is disabled by default. Enable it by setting `MEMORY_CONSOLIDATION_MODEL` to a model identifier. See [configuration](/kinbot/docs/memory/configuration/#memory-consolidation) for all settings.

## Session Compacting

When conversations grow long, KinBot automatically **compacts** them:

1. The conversation reaches a threshold (message count or token count)
2. A summarization model distills the conversation into a compact snapshot
3. The snapshot replaces the full history, preserving context while reducing token usage
4. Multiple snapshots are kept (up to `COMPACTING_MAX_SNAPSHOTS`) for layered context

## Data Flow

```
User message
  → Contextual rewrite (if short/ambiguous)
  → Multi-query expansion (if enabled)
  → Hybrid search (vector + FTS) per query
  → RRF fusion → score weighting → re-rank → adaptive K
  → Relevant memories injected into Kin context
  → LLM processes and responds
  → Extraction pipeline analyzes the turn
  → New memories stored as embeddings
  → Retrieval counts updated
```
