---
title: How Memory Works
description: Understanding KinBot's memory system — extraction, retrieval, and the advanced search pipeline.
---

KinBot gives each Kin persistent memory across conversations. The system uses two complementary channels: **automatic extraction** and **explicit remembering**, backed by a sophisticated hybrid search pipeline. Memories can be **private** (default, only the owning Kin can access them) or **shared** (visible and searchable by all Kins).

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

## Shared Memories

By default, memories are **private** to the Kin that created them. However, Kins can mark memories as **shared** to make them searchable by all other Kins in the instance.

### When to share

Shared memories are for information that genuinely helps other Kins: cross-domain facts (infrastructure details, user-wide preferences, project decisions affecting everyone), organizational changes, or user availability. Kins should **not** share internal reasoning, task-specific details, or domain-specific knowledge that other Kins would never need.

### How it works

- The `memorize` and `update_memory` tools accept an optional `scope` parameter: `"private"` (default) or `"shared"`
- `recall` automatically searches both private and shared memories, with shared results attributed to their author Kin (e.g. *[shared by Assistant]*)
- `list_memories` can filter by scope; `"shared"` lists shared memories from all Kins
- Deduplication checks span both scopes to prevent redundant entries
- The prompt builder adds `*[shared by Kin Name]*` attribution to shared memories injected in context

## Memory Tools

Kins have six memory tools available (main agent only):

| Tool | Description |
|------|-------------|
| `recall` | Semantic + keyword search across private + shared memories |
| `memorize` | Save a new memory (private or shared) |
| `update_memory` | Update content, category, subject, or scope |
| `forget` | Delete an outdated or incorrect memory |
| `list_memories` | List memories, filtered by subject, category, or scope |
| `review_memories` | LLM-powered audit that detects contradictions, duplicates, stale entries, and clutter |

Both `recall` and `list_memories` include conversational provenance: when a memory has a `sourceContext` (the context in which it was learned), it's included in the result. Shared memories also include `authorKinName` attribution.

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
- **Recency boost** — Very recent memories get an extra multiplier: ×1.5 for today, ×1.25 for this week, ×1.1 for this month. Enabled by default, disable with `MEMORY_RECENCY_BOOST=false`
- **Category boost** — Memories matching a detected category in the query get a configurable multiplier (default 1.2×, set via `MEMORY_CATEGORY_BOOST`)

### 6. Re-ranking (Optional)

If enabled via `MEMORY_RERANK_MODEL`, top candidates are re-ranked for relevance. KinBot supports two re-ranking strategies:

1. **Cross-encoder rerank (preferred)** — If a provider with `rerank` capability is configured (Cohere or Jina), KinBot calls their dedicated rerank API. Cross-encoders are ~20× faster and ~10× cheaper than LLM rerankers with comparable accuracy.
2. **LLM-based rerank (fallback)** — If no rerank provider is available, an LLM scores each memory's relevance on a 0-10 scale. The LLM score becomes the primary ranking signal, with the hybrid score as tiebreaker.

The system tries cross-encoder first and falls back to LLM automatically. Controlled by `MEMORY_RERANK_MODEL` — disabled by default.

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

## Stale Memory Pruning

After importance recalibration runs during compacting, KinBot automatically prunes memories that have decayed to very low importance and are never retrieved. This completes the importance lifecycle: extraction → recalibration → pruning.

The pruning is purely heuristic-based, no LLM calls needed:

| Condition | Threshold |
|-----------|-----------|
| Importance ≤ 1, never retrieved | Older than **60 days** |
| Importance ≤ 2, never retrieved | Older than **90 days** |

Pruned memories are permanently deleted. The number of pruned memories is recorded in the compacting system message metadata alongside extraction and consolidation counts.

## Session Compacting

When conversations grow long, KinBot automatically **compacts** them using **incremental micro-batch summarization**:

1. After each LLM turn, the system checks if the number of non-compacted messages exceeds a threshold (`COMPACTING_BATCH_SIZE` + `COMPACTING_MIN_KEEP_MESSAGES`, default: 35)
2. A fixed-size batch of the oldest messages is summarized by a dedicated model, keeping at least `COMPACTING_MIN_KEEP_MESSAGES` (default: 15) as raw context
3. The snapshot replaces the full history, preserving context while reducing token usage
4. Multiple snapshots are kept (up to `COMPACTING_MAX_SNAPSHOTS`) for layered context

Before compacting runs, a **progressive context pipeline** reduces in-memory context size without any LLM calls:
- **Intact zone** — Recent tool results kept in full
- **Observation zone** — Middle-aged tool results truncated
- **Collapsed zone** — Oldest tool results collapsed to one-line summaries

The token-based threshold (`COMPACTING_THRESHOLD_PERCENT`, default: 75%) acts as a fallback safety net.

## Data Flow

```
User message
  → Contextual rewrite (if short/ambiguous)
  → Multi-query expansion (if enabled)
  → Hybrid search (vector + FTS) per query
  → RRF fusion → score weighting → re-rank → adaptive K
  → Relevant memories injected into Kin context with prioritization guidance
  → LLM processes and responds
  → Extraction pipeline analyzes the turn
  → New memories stored as embeddings
  → Retrieval counts updated

Compacting cycle (after each LLM turn):
  → Progressive context pipeline (tool masking + observation compaction)
  → Message-count check → micro-batch summarization if needed
  → Extract new memories from compacted batch
  → Consolidate similar memories
  → Recalibrate importance scores
  → Prune stale memories (low importance, never retrieved, old)
```
