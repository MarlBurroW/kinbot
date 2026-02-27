# Twitter/X Launch Thread Draft

**Best timing:** Tuesday/Wednesday, 14:00-16:00 UTC (US morning)

---

**Tweet 1:**

🤖 I've been building KinBot — a self-hosted platform for AI agents that never forget.

Each agent has a name, personality, and memory that spans every conversation. They collaborate, run cron jobs, and live on your hardware.

One process. One SQLite file. AGPL-3.0.

↓

---

**Tweet 2:**

Why I built this:

Every AI tool I used treated conversations as disposable. Ask something Monday, forgotten by Tuesday.

KinBot agents have continuous memory — vector search + full-text across months of interactions. They know who you are and what you've discussed.

---

**Tweet 3:**

What makes it different from Open WebUI / LobeChat / etc.:

→ Agents have identity, not just a system prompt
→ Memory persists across ALL sessions (not just the current one)
→ Agents can spawn sub-agents and talk to each other
→ Zero infra: one process, one SQLite file, done
→ 23+ providers incl. Ollama for fully local

---

**Tweet 4:**

github.com/MarlBurroW/kinbot

Built with Bun + Hono + React. Docker one-liner to try it:

docker run -d -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot

Early days, feedback welcome. Star if it looks interesting ⭐

---

**Notes:**
- Lead with GIF/video if available
- Use 1-2 hashtags max: #selfhosted #opensource
- Tag relevant accounts if appropriate
