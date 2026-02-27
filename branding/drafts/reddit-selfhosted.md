# r/selfhosted Post Draft

**Title:** `I built KinBot — self-hosted AI agents with persistent memory (AGPL, one SQLite file)`

**Flair:** AI / Machine Learning

**Body:**

Hey r/selfhosted,

I've been working on KinBot for the past year. The idea: AI agents that actually remember you.

Most AI tools reset every conversation. KinBot gives each agent a persistent identity (name, role, personality), continuous memory (vector + full-text search across all conversations), and the ability to collaborate with other agents.

It runs as a single process with one SQLite file. No Postgres, no Redis, no external dependencies. Docker one-liner or curl installer.

**What it does:**
- Create specialized agents ("Kins") with distinct roles and personalities
- They remember everything across sessions — no more "as an AI, I don't have memory of previous conversations"
- Agents can delegate tasks to each other
- Cron jobs, webhooks, 6 channel integrations (Telegram, Discord, Slack, WhatsApp, Signal, Matrix)
- Encrypted vault for secrets (AES-256-GCM)
- Multi-user with auth (admin + member roles)
- 23+ AI providers supported (including Ollama for fully local)
- Notifications, human-in-the-loop approval, contacts management

**Stack:** Bun + Hono + React + SQLite
**License:** AGPL-3.0

```bash
docker run -d --name kinbot -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot:latest
```

GitHub: https://github.com/MarlBurroW/kinbot
Site: https://marlburrow.github.io/kinbot/

Happy to answer any questions. Feedback welcome — especially on what features matter most to you for a self-hosted AI platform.

---

**Notes:**
- Screenshots MANDATORY before posting
- Respond to every comment in the first 6 hours
- Be honest about limitations
- Provider count updated to 23+
