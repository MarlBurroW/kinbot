---
title: Memory Configuration
description: Configure memory extraction, retrieval, search pipeline, and compacting behavior.
---

Memory behavior is controlled through environment variables. All settings have sensible defaults. The advanced search features (multi-query, re-ranking, contextual rewrite) are disabled by default and can be enabled by setting their respective model variables.

## Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_EXTRACTION_MODEL` | Provider default | Model used for automatic memory extraction after each turn |
| `MEMORY_MAX_RELEVANT` | `10` | Maximum relevant memories injected into context per turn |
| `MEMORY_SIMILARITY_THRESHOLD` | `0.7` | Minimum cosine similarity for vector search results (0-1) |
| `MEMORY_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for memory vectors |
| `MEMORY_EMBEDDING_DIMENSION` | `1536` | Vector dimension for embeddings |

## Search Pipeline Settings

These control the hybrid search, scoring, and result selection pipeline.

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_RRF_K` | `60` | Reciprocal Rank Fusion smoothing constant. Higher values give more weight to lower-ranked results |
| `MEMORY_FTS_BOOST` | `1.2` | Multiplier for FTS results in RRF scoring. Values > 1 favor keyword matches |
| `MEMORY_SUBJECT_BOOST` | `1.3` | Score multiplier when a memory's subject matches an entity in the query |
| `MEMORY_CATEGORY_BOOST` | `1.25` | Score multiplier for category-matching memories |
| `MEMORY_TEMPORAL_DECAY_LAMBDA` | `0.01` | Temporal decay rate. Higher = faster decay. Set to `0` to disable. Category-adjusted: facts decay 10× slower than decisions |
| `MEMORY_TEMPORAL_DECAY_FLOOR` | `0.7` | Minimum score multiplier from temporal decay. Prevents old memories from being completely suppressed |
| `MEMORY_TOKEN_BUDGET` | `0` | Max tokens for the memory block in prompt. `0` = unlimited (no budget enforcement) |
| `MEMORY_RECENCY_BOOST` | `true` | Enable recency-based score boost (×1.5 today, ×1.25 this week, ×1.1 this month). Set to `false` to disable |
| `MEMORY_ADAPTIVE_K` | `true` | Enable adaptive result trimming based on score distribution |
| `MEMORY_ADAPTIVE_K_MIN_SCORE_RATIO` | `0.3` | Minimum score as a ratio of the top result. Results below this are dropped |

## Optional LLM Enhancements

These features use additional LLM calls to improve retrieval quality. Each is disabled by default (no model set). Set a model name to enable.

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_MULTI_QUERY_MODEL` | *(disabled)* | Model for generating query variations. Expands each query into 3 alternatives targeting different aspects |
| `MEMORY_HYDE_MODEL` | *(disabled)* | Model for HyDE (Hypothetical Document Embedding). Generates a hypothetical answer to use as an additional search query for better semantic matching |
| `MEMORY_RERANK_MODEL` | *(disabled)* | Model for re-ranking. If a rerank provider (Cohere/Jina) is configured, uses their cross-encoder API (~20× faster). Otherwise falls back to LLM-based scoring (0-10 scale) |
| `MEMORY_CONTEXTUAL_REWRITE_MODEL` | *(disabled)* | Model for rewriting short/ambiguous messages into standalone queries using conversation context |
| `MEMORY_CONTEXTUAL_REWRITE_THRESHOLD` | `80` | Character length threshold. Messages shorter than this are candidates for contextual rewriting |

:::tip
For LLM enhancement models, use a fast/cheap model (e.g. `gpt-4.1-mini`) since they run on every retrieval. The quality gain comes from the technique, not the model size.
:::

## Memory Consolidation

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_CONSOLIDATION_MODEL` | *(disabled)* | Model for memory consolidation (merging similar memories) |
| `MEMORY_CONSOLIDATION_SIMILARITY` | `0.85` | Cosine similarity threshold for considering two memories as candidates for consolidation |
| `MEMORY_CONSOLIDATION_MAX_GEN` | `5` | Maximum number of consolidated memories generated per run |

Consolidation clusters are capped at 3 memories to preserve detail. Larger groups are split and merged incrementally across runs. The LLM can also abort a merge if it determines the memories are about different topics.

## Compacting Settings

Session compacting uses **incremental micro-batch summarization**: instead of compacting all messages at once, old messages are summarized in fixed-size batches from the oldest end after each LLM turn, spreading LLM cost over time.

### Primary trigger (message-count based)

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPACTING_BATCH_SIZE` | `20` | Number of messages per micro-compaction batch |
| `COMPACTING_MIN_KEEP_MESSAGES` | `15` | Minimum non-compacted messages to keep as raw context. A batch is only taken when non-compacted count exceeds `COMPACTING_BATCH_SIZE` + `COMPACTING_MIN_KEEP_MESSAGES` |

### Fallback trigger and general settings

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPACTING_THRESHOLD_PERCENT` | `75` | Fallback trigger: compact when context usage reaches this % of the model's context window (50-95). The primary trigger is message-count-based |
| `COMPACTING_MODEL` | Provider default | Model used for session compacting/summarization |
| `COMPACTING_MAX_SNAPSHOTS` | `10` | Maximum compacting snapshots kept per Kin |

The threshold can also be configured per-Kin (overrides the global setting) or via **Settings > Memory** in the UI.

### Progressive context pipeline

Before compacting runs, KinBot applies a progressive pipeline to reduce context size without LLM calls:

| Variable | Default | Description |
|----------|---------|-------------|
| `TOOL_RESULT_MASK_KEEP_LAST` | `2` | Number of recent tool call groups kept fully intact. Older groups are collapsed to one-line summaries |
| `OBSERVATION_COMPACTION_WINDOW` | `10` | Number of recent turns kept at full resolution. Older turns have tool results truncated. `0` = disabled |
| `OBSERVATION_MAX_CHARS` | `200` | Max characters for truncated tool results in the observation zone |
| `HISTORY_TOKEN_BUDGET` | `0` (disabled) | Emergency safety net: max tokens for conversation history. Messages trimmed from oldest end if exceeded. `0` = no limit |

## Embedding Provider

Memory requires an **embedding provider** to be configured in **Settings > Providers**. Supported embedding providers:

- **OpenAI** — `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`
- **Voyage** — Specialized embedding models
- **Jina AI** — Multilingual embeddings
- **Nomic** — Open-source embeddings
- **Mistral** — Built-in embedding support
- **DeepSeek** — Embedding support
- **Cohere** — `embed-english-v3.0`, `embed-multilingual-v3.0`
- **Together AI** — Various embedding models
- **Fireworks AI** — Embedding support
- **Ollama** — Local embedding models
- **OpenRouter** — Access to multiple embedding providers
- **xAI** — Embedding support

:::caution
Without an embedding provider, memory storage and retrieval will not work. The Kin will still function but won't remember anything across sessions.
:::

## Tuning Tips

### Basic Tuning
- **Lower `MEMORY_SIMILARITY_THRESHOLD`** (e.g., 0.5) to retrieve more memories at the cost of relevance
- **Raise `MEMORY_MAX_RELEVANT`** if your Kin needs broader context awareness
- **Lower `COMPACTING_BATCH_SIZE`** for more frequent, smaller compaction cycles
- **Raise `COMPACTING_MIN_KEEP_MESSAGES`** to keep more raw context visible to the LLM

### Search Quality
- **Enable multi-query** (`MEMORY_MULTI_QUERY_MODEL=gpt-4.1-mini`) for better recall on complex queries
- **Enable re-ranking** (`MEMORY_RERANK_MODEL=gpt-4.1-mini`) for better precision when you have many memories
- **Enable contextual rewrite** (`MEMORY_CONTEXTUAL_REWRITE_MODEL=gpt-4.1-mini`) if your users send lots of short follow-up messages
- **Increase `MEMORY_FTS_BOOST`** (e.g., 1.5) if keyword matching should matter more than semantic similarity

### Performance
- Use a **faster/cheaper model** for `MEMORY_EXTRACTION_MODEL` since it runs on every turn
- LLM enhancements (multi-query, re-rank, rewrite) each add one LLM call per retrieval. Enable selectively based on your needs
- **Disable temporal decay** (`MEMORY_TEMPORAL_DECAY_LAMBDA=0`) if all memories should be treated equally regardless of age
