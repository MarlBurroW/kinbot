# Hacker News — Show HN Post Draft

**Title:** `Show HN: KinBot – Self-hosted AI agents with persistent identity and memory`

**URL:** https://github.com/MarlBurroW/kinbot

**First comment:**

Hi HN,

KinBot is a platform for creating AI agents ("Kins") that have persistent identity and continuous memory. Unlike typical chat UIs where each conversation is disposable, a Kin remembers every interaction from day one.

Key design decisions:
- Single SQLite file for everything (messages, memory vectors, config). No external DBs.
- Memory is dual-channel: automatic extraction on every LLM turn + explicit remember() tool
- Session compacting (summarization) to stay within token limits while preserving full history
- Inter-agent communication with correlation IDs and rate limiting
- AES-256-GCM vault for secrets that never appear in prompts
- 6 channel integrations (Telegram, Discord, Slack, WhatsApp, Signal, Matrix)
- Human-in-the-loop approval for sensitive agent actions

Built with Bun + Hono (backend) and React (frontend). Supports 25+ providers including Ollama for fully local inference.

I've been running it personally for several months with agents handling everything from code review to home automation orchestration.

Source: https://github.com/MarlBurroW/kinbot
Site: https://marlburrow.github.io/kinbot/

---

**Notes:**
- No emoji in responses
- Technical, factual, humble tone
- Mention trade-offs proactively
- Respond to every substantive comment in first 2 hours
- Best timing: Tuesday/Wednesday, 9-11 AM EST
