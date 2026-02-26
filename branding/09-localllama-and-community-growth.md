# KinBot — r/LocalLLaMA Draft + Post-Launch Community Growth

*Run #9 — 2026-02-26*

Focus: **Flesh out the r/LocalLLaMA post (Ollama-first angle) and build a concrete post-launch community nurturing plan.**

---

## r/LocalLLaMA Post Draft

**Titre :** `KinBot: self-hosted AI agents with persistent memory — works great with Ollama for 100% local inference`

**Corps :**

```
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

**Providers supported:** 22+ including Ollama, OpenAI-compatible (anything with /v1/chat/completions), Anthropic, Gemini, Mistral, DeepSeek, Groq, Together, Fireworks, Cohere, xAI, and more. You can mix providers — e.g. Ollama for daily chat, Claude for complex reasoning, Jina for embeddings.

**Stack:** Bun + Hono + React + SQLite + Drizzle ORM

GitHub: https://github.com/MarlBurroW/kinbot

I'm running it at home on a mini-PC with a 3090 for inference. Happy to answer questions about local setups, memory architecture, or anything else.
```

### Why this angle works for r/LocalLLaMA

1. **Leads with Ollama**, not cloud providers. This crowd runs their own models.
2. **Mentions vLLM, llama.cpp, LM Studio, text-gen-webui** — shows awareness of the ecosystem.
3. **"Zero infra"** resonates with people already running Ollama on bare metal.
4. **Local embeddings** — important detail, most competitors need OpenAI embeddings.
5. **Privacy section** — this sub cares deeply about data sovereignty.
6. **Hardware mention** (mini-PC + 3090) — makes it relatable, not corporate.
7. **"Mix providers"** — speaks to people who use different models for different tasks.

### Expected objections (specific to r/LocalLLaMA)

| Objection | Response |
|-----------|----------|
| "How is this different from Open WebUI?" | "Open WebUI is a great chat interface. KinBot is an agent platform — persistent identity, inter-agent communication, memory that spans months, cron automation. Different use case." |
| "Does it support GGUF/GPTQ directly?" | "It connects to inference servers (Ollama, vLLM, etc.), it doesn't run inference itself. This keeps KinBot lightweight and lets you use whatever quantization/backend you prefer." |
| "What embedding model for memory?" | "Any Ollama model that supports embeddings, or dedicated providers like Nomic, Jina, Voyage. Fully configurable per-instance." |
| "SQLite for vector search? Really?" | "Yes — using a custom implementation with HNSW-style indexing. Works well up to tens of thousands of memories. For most personal/small-team use, it's more than enough without needing a separate vector DB." |
| "AGPL is not really free" | "AGPL means if you modify and host it as a service, you share the code. For self-hosting on your own hardware (which is everyone here), it's exactly like GPL. Your modifications stay yours unless you offer it as a hosted service to others." |

---

## Post-Launch Community Growth Plan

### Week 1-2: Active Engagement

**Goal:** Convert initial visitors into users and stargazers.

- **Respond to every single comment** on launch posts within 2 hours. This is non-negotiable for the first 48h.
- **File issues from feedback.** When someone suggests something, create a GitHub issue tagged `community-request` and reply with the link. This shows you listen.
- **Quick-fix visible bugs.** If someone reports a bug in the first week, fix it fast and tag them in the PR. Nothing builds trust faster.
- **Post a "Week 1 update"** on r/selfhosted as a comment on the original post (not a new post): "Thanks for the feedback, here's what we shipped this week based on your suggestions."

### Week 3-4: Content Seeding

**Goal:** Create reasons for people to revisit.

1. **Write a blog post / GitHub Discussion: "How KinBot's memory system works"**
   - Technical deep-dive on the dual-channel memory architecture
   - Post to r/LocalLLaMA as a standalone technical post (not promo)
   - Cross-post to HN as a technical article
   - This establishes credibility as a serious project, not just another wrapper

2. **Create a "Kin recipes" page or discussion thread**
   - Example Kins with system prompts people can copy:
     - "Home automation coordinator" (with Ollama + local models)
     - "Code reviewer" (connects to GitHub webhooks)
     - "Daily briefing agent" (cron + Telegram)
     - "Research assistant" (with memory for ongoing projects)
   - Let the community contribute their own recipes

3. **Record a 5-min YouTube video** (or ask a self-hosted YouTuber to cover it)
   - Target: TechnoTim, Wolfgang, Jim's Garage, Awesome Open Source
   - Don't ask directly for a video — engage in their Discord, be helpful, mention naturally

### Month 2-3: Ecosystem Integration

**Goal:** Make KinBot part of the self-hosted ecosystem.

1. **Submit to awesome-selfhosted**
   - Wait until you have 100+ stars and a few community PRs
   - Category: Artificial Intelligence → Personal Assistants
   - PR must be clean: one line, alphabetical, correct formatting

2. **Submit to awesome-ai-agents** and similar curated lists
   - Same approach, wait for social proof

3. **MCP server marketplace presence**
   - KinBot supports MCP — make sure it's listed in MCP directories
   - Write 1-2 reference MCP server implementations that work well with KinBot
   - This creates inbound traffic from the MCP community

4. **Docker Hub / LinuxServer.io**
   - Already on GHCR, but consider Docker Hub for discoverability
   - Reach out to LinuxServer.io for a community image (they have high standards, but the exposure is massive)

### Month 3-6: Community Building

**Goal:** Transition from "Nicolas's project" to "a community project."

1. **GitHub Discussions as the community hub**
   - Categories: General, Show Your Kin, Feature Requests, Help
   - Actively answer questions, pin good discussions
   - This is better than Discord for SEO and discoverability

2. **"Good First Issues" pipeline**
   - Always maintain 3-5 open good-first-issue items
   - Types that work well: add a provider, add a translation, fix a UI nit, improve docs
   - Respond to first-time contributor PRs within 24h with genuine encouragement

3. **Monthly changelog posts**
   - Not just release notes — write a short narrative: "This month we added X because community member Y suggested it"
   - Post to r/selfhosted every 2-3 months (not more, or it feels spammy)

4. **Consider a Discord / Matrix space** (only when there's demand)
   - Don't create one preemptively — empty community spaces look bad
   - When you get 5+ people asking for real-time chat, that's the signal

### Ongoing: Content Flywheel

**Goal:** Steady organic traffic without active promotion.

| Content Type | Frequency | Platform |
|-------------|-----------|----------|
| Technical blog post (memory, agents, architecture) | Monthly | GitHub Discussions → cross-post HN/Reddit |
| Release notes with narrative | Per release | GitHub Releases → link on Twitter |
| "Kin recipe" showcase | Biweekly | GitHub Discussions |
| Reply to "what self-hosted AI tools do you use?" threads | When they appear | r/selfhosted, r/LocalLLaMA, HN |
| Comparison articles (vs Open WebUI, vs LobeChat) | Once, keep updated | README or site |

The most effective long-term strategy: **be helpful in communities without mentioning KinBot, then people check your profile, see the project, and discover it organically.** Nicolas should be active on r/selfhosted and r/LocalLLaMA answering AI/self-hosting questions generally.

---

## Metrics to Track

| Metric | Tool | Why |
|--------|------|-----|
| GitHub stars over time | GitHub insights | Overall interest trajectory |
| Docker pulls | GHCR stats | Actual usage (more meaningful than stars) |
| Issues opened by non-maintainers | GitHub | Community engagement signal |
| PRs from external contributors | GitHub | Health of contribution pipeline |
| r/selfhosted mentions (search) | Reddit search | Organic word-of-mouth |
| Referral traffic to repo | GitHub insights → Traffic | Which channels drive real visits |

---

## Key Principle

**Community growth for open-source is a marathon, not a sprint.** The launch posts generate a spike. What matters is the steady baseline of 5-10 new stars/week that comes from being genuinely useful, responsive, and present in the ecosystem. Every issue answered fast, every PR reviewed promptly, every technical blog post — they compound.

Don't optimize for virality. Optimize for trust.
