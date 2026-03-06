---
title: Memory Configuration
description: Configure memory extraction, retrieval, and compacting behavior.
---

Memory behavior is controlled through environment variables. All settings have sensible defaults.

## Memory Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_EXTRACTION_MODEL` | Provider default | Model used for automatic memory extraction |
| `MEMORY_MAX_RELEVANT` | `10` | Maximum relevant memories injected into context per turn |
| `MEMORY_SIMILARITY_THRESHOLD` | `0.7` | Minimum cosine similarity for memory retrieval (0-1) |
| `MEMORY_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for memory vectors |
| `MEMORY_EMBEDDING_DIMENSION` | `1536` | Vector dimension for embeddings |

## Compacting Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPACTING_MESSAGE_THRESHOLD` | `50` | Messages before auto-compacting triggers |
| `COMPACTING_TOKEN_THRESHOLD` | `30000` | Token count before auto-compacting triggers |
| `COMPACTING_MODEL` | Provider default | Model used for session compacting/summarization |
| `COMPACTING_MAX_SNAPSHOTS` | `10` | Maximum compacting snapshots kept per Kin |

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

- **Lower `MEMORY_SIMILARITY_THRESHOLD`** (e.g., 0.5) to retrieve more memories, at the cost of less relevant results
- **Raise `MEMORY_MAX_RELEVANT`** if your Kin needs broader context awareness
- **Lower `COMPACTING_MESSAGE_THRESHOLD`** for Kins with very long conversations to compact more frequently
- Use a **faster/cheaper model** for `MEMORY_EXTRACTION_MODEL` since it runs on every turn
