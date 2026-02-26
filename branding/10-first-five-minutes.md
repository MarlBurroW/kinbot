# KinBot — First 5 Minutes: Developer Experience Audit & Onboarding Optimization

*Run #10 — 2026-02-26*

Focus: **What happens from `docker run` to "wow, this is cool"? Audit the new user journey and optimize conversion from visitor → user → advocate.**

---

## Why This Matters

Open-source projects live or die in the first 5 minutes. Someone sees the Reddit post, clicks the repo, copies the docker command, and... what? If the path from install to "aha moment" has friction, they close the tab and never come back. No amount of branding fixes a bad first run.

---

## The Current Journey (Audited)

### Step 1: Docker Run (30 seconds)
```bash
docker run -d --name kinbot -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot:latest
```

**Verdict: ✅ Excellent.** Single command, no env vars required, sensible defaults. Volume mount means data persists. This is exactly right.

**One concern:** Does the container log a clear "KinBot is running at http://localhost:3000" message? New users will `docker logs kinbot` to check if it started. That log line should be unmissable.

**Action:** Verify startup logs include a clear, friendly banner:
```
🤖 KinBot is running at http://localhost:3000
   First time? Open the URL to start the setup wizard.
```

### Step 2: Open Browser → Onboarding Wizard
The README says "The onboarding wizard handles the rest." This is the critical moment.

**Questions to verify (Nicolas should test on a fresh install):**

1. **Does the wizard auto-start on first visit?** If someone lands on a login page with no account, they'll bounce. The wizard should intercept.
2. **How many steps?** Ideal: 3-4 max. Create admin account → Add a provider (with Ollama auto-detect) → Create first Kin → Done.
3. **Is Ollama auto-detected?** If someone runs Ollama on the same machine, KinBot should find it without any config. This is the magic moment for r/LocalLLaMA users.
4. **Is there a default/template Kin?** New users shouldn't face a blank canvas. Offer a "General Assistant" template they can customize later.
5. **How fast to first message?** From opening the browser to sending the first message to a Kin should be under 2 minutes.

### Step 3: First Conversation
This is the "aha moment." The user sends a message and gets a response. But the REAL aha is when they experience memory.

**Problem:** Memory only shines over time. In the first session, KinBot behaves like any other chat UI. The differentiator is invisible.

**Solutions to surface the value immediately:**

#### Option A: Guided First Conversation
After creating the first Kin, show a subtle prompt card:
> "Try telling your Kin something about yourself, then ask about it in a new message. Watch it remember."

This guides the user to test the core feature without feeling like a tutorial.

#### Option B: Pre-seeded Demo Kin
Offer an optional "Demo Kin" that comes with a few pre-loaded memories, showing what a Kin looks like after weeks of use. The user can chat with it and see memory recall in action immediately. Delete it when done exploring.

#### Option C: Memory Indicator in UI
When a Kin stores a memory (automatic extraction), show a subtle toast or sidebar indicator: "🧠 Remembered: [extracted fact]". This makes the invisible visible. The user sees memory happening in real-time and immediately understands the value.

**Recommendation:** Option C is the strongest. It's non-intrusive, works for every conversation, and directly demonstrates the core differentiator. Option A is a good complement for the very first session.

### Step 4: "This is cool" → Share
The user has had a good first experience. Now what?

**Current state:** Nothing prompts sharing. No "Star us on GitHub" in the UI, no link to community, no way to give feedback.

**Suggestions (subtle, not obnoxious):**
- Settings page footer: "KinBot is open-source. ⭐ Star on GitHub · 💬 Discussions · 🐛 Report a bug"
- After 10 messages (or 1 day of use): one-time toast "Enjoying KinBot? Star us on GitHub to help the project grow."
- **Never** gate features behind stars or social actions. That's hostile.

---

## The Ollama Fast Path

For r/LocalLLaMA users, the dream scenario:

```
1. Already running Ollama with models pulled
2. docker run kinbot
3. Open browser
4. Wizard detects Ollama automatically: "Found Ollama with 3 models: llama3, mistral, codellama"
5. Create admin account (30 sec)
6. Create first Kin, pick llama3 from dropdown
7. Chat. Memory works. Everything local.
```

Total time: ~2 minutes. Zero API keys. Zero cloud. This is the killer onboarding for the self-hosted crowd.

**Verify this path works perfectly.** If Ollama auto-detection has any friction (wrong default URL, needs manual config, models don't show up), fix it before launch. This is the #1 conversion path from the #1 target audience.

---

## Getting Started Guide Draft

This could live as a blog post, a GitHub Discussion, or a docs page. It's the "hand-holding" version of the README for people who want more guidance.

### Title: "Your First Hour with KinBot"

---

**KinBot runs in one command:**

```bash
docker run -d --name kinbot -p 3000:3000 -v kinbot-data:/app/data ghcr.io/marlburrow/kinbot:latest
```

Open http://localhost:3000. The setup wizard walks you through creating your admin account and connecting your first AI provider.

**Using Ollama?** KinBot auto-detects it on localhost:11434. No config needed, just make sure Ollama is running and you've pulled at least one model (`ollama pull llama3`).

**Using a cloud provider?** Grab an API key from Anthropic, OpenAI, Gemini, or any of the 22+ supported providers, and paste it in the wizard.

#### Create Your First Kin

A Kin is an AI agent with a persistent identity. Give it:
- **A name** — something that fits its role (e.g., "Atlas" for a research assistant)
- **A description** — what it specializes in
- **A character** — how it communicates (formal, casual, technical, creative)
- **A model** — which LLM powers it

Start simple. You can always refine later.

#### The Memory Difference

Send a few messages. Tell your Kin about a project you're working on, a preference you have, or a decision you made. Then, in a later message (or tomorrow), reference it casually.

Your Kin remembers. Not because you told it to, but because KinBot automatically extracts and indexes important facts from every conversation. This is the core difference: your agents accumulate knowledge over time.

You can also explicitly ask a Kin to remember something: *"Remember that our deploy target is always port 8443."* It'll store that as a high-priority memory.

#### Add More Kins

KinBot shines with specialized agents:
- A **code reviewer** that knows your stack and conventions
- A **writing editor** with your style preferences
- A **project manager** that tracks tasks across conversations
- A **home automation coordinator** connected via webhooks

Each Kin has its own memory, identity, and conversation history. They can even talk to each other.

#### Connect Your Life

Set up a Telegram bot so you can message your Kins from your phone. Add a cron job so your research Kin summarizes news every morning. Create a webhook so your CI pipeline notifies your DevOps Kin on failures.

KinBot goes from "cool chat UI" to "personal AI infrastructure" when you connect it to your workflows.

---

## Onboarding Friction Checklist

Nicolas should test each of these on a **fresh Docker install** (no existing data):

| # | Check | Expected | Pass? |
|---|-------|----------|-------|
| 1 | Container starts without errors | Clean logs, "running on port 3000" message | |
| 2 | First browser visit shows wizard (not login) | Wizard intercepts, no 404/blank | |
| 3 | Admin account creation works | Email + password, instant redirect | |
| 4 | Ollama auto-detected (if running) | Provider appears without manual config | |
| 5 | Manual provider setup (API key) | Paste key, validation check, models load | |
| 6 | First Kin creation | Name + model, under 30 seconds | |
| 7 | First message sent and response received | Streaming response, no errors | |
| 8 | Memory extraction visible somehow | Toast, sidebar, or log indication | |
| 9 | Time from docker run to first response | Under 3 minutes total | |
| 10 | Data persists after container restart | `docker restart kinbot` → data intact | |

---

## Messaging for the First Run

### Error States Matter

What happens when things go wrong? Bad first-error messages kill trust.

| Error | Bad message | Good message |
|-------|------------|--------------|
| No provider configured | "Error: no provider" | "No AI provider configured yet. Add one in Settings → Providers. KinBot supports Ollama (local), OpenAI, Anthropic, and 20+ more." |
| Ollama not reachable | "Connection refused" | "Can't reach Ollama at localhost:11434. Is it running? Try: `ollama serve`" |
| Invalid API key | "401 Unauthorized" | "That API key didn't work. Double-check it on your provider's dashboard." |
| Model not found | "Model not found" | "Model 'llama3' not found on your Ollama instance. Available models: [list]. Pull it with: `ollama pull llama3`" |

Every error is a chance to help the user succeed instead of bouncing them.

---

## Key Metrics for First-Run Success

After launch, track these (if possible via opt-in telemetry or user surveys):

1. **Time to first message** — target: under 3 minutes
2. **Wizard completion rate** — how many people finish setup vs abandon
3. **Provider distribution** — what % use Ollama vs cloud? (informs marketing focus)
4. **Day 2 retention** — did they come back?

Even without telemetry, ask early users in GitHub Discussions: "How was your setup experience? How long did it take?"

---

## TL;DR

The install is already great (one docker command). The gap is in **surfacing the value proposition during the first session**:

1. **Make memory visible** — show a UI indicator when facts are extracted
2. **Guide the first conversation** — prompt users to test memory recall
3. **Nail the Ollama path** — auto-detection must be frictionless
4. **Polish error messages** — every error should include a fix, not just a code
5. **Test the full path** on a fresh install before launch

The first 5 minutes determine whether someone stars the repo or closes the tab. Make those minutes count.
