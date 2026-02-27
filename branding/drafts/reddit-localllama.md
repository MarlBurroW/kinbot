# r/LocalLLaMA Post Draft

**Title:** `KinBot: self-hosted AI agents with persistent memory — works great with Ollama for 100% local inference`

**Body:**

I've been working on KinBot, a self-hosted platform for AI agents with persistent identity and memory. Wanted to share it here because it was built with local-first in mind.

**The Ollama story:** KinBot auto-detects Ollama on localhost:11434. No API key, no config file, no cloud signup. Just point it at your Ollama instance and your agents have access to every model you've pulled. Same goes for any OpenAI-compatible endpoint (vLLM, llama.cpp server, LM Studio, text-generation-webui, etc.).

**What KinBot actually does:**

You create "Kins" — AI agents with a name, role, personality, and persistent memory. Unlike typical chat UIs:

- **Memory spans all sessions.** Ask your Kin something in January, reference it in June. It remembers. Dual-channel: automatic extraction on every turn + explicit remember() tool. Hybrid search (vector similarity + full-text).
- **Agents collaborate.** A Kin can delegate work to sub-agents, or message another Kin directly. Rate-limited so they don't loop.
- **Automation built in.** Cron jobs, webhooks, 6 chat platform integrations (Telegram, Discord, Slack, WhatsApp, Signal, Matrix).
- **Zero infra.** Single process, single SQLite file. No Postgres, no Redis, no Elasticsearch. Docker one-liner or curl installer.

**For the privacy-conscious:**
- AGPL-3.0, fully self-hosted
- AES-256-GCM encrypted vault for API keys/secrets (never exposed in prompts)
- Embedding providers supported locally too (Ollama embeddings work for the memory system)

**Resource usage:** KinBot itself is lightweight (Bun runtime, ~100MB RAM idle). The heavy lifting is your LLM inference, which you control.

**Providers supported:** 23+ including Ollama, OpenAI-compatible (anything with /v1/chat/completions), Anthropic, Gemini, Mistral, DeepSeek, Groq, Together, Fireworks, Cohere, xAI, and more. You can mix providers — e.g. Ollama for daily chat, Claude for complex reasoning, Jina for embeddings.

**Stack:** Bun + Hono + React + SQLite

```bash
docker run -d --name kinbot -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot:latest
```

GitHub: https://github.com/MarlBurroW/kinbot

I'm running it at home on a mini-PC with a 3090 for inference. Happy to answer questions about local setups, memory architecture, or anything else.

---

**Notes:**
- Lead with Ollama, not cloud providers
- Mention specific models (Llama 3, Mistral, Qwen)
- Emphasize local embeddings support
- Screenshots needed before posting
