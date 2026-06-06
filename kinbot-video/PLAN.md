# KinBot — install / demo video plan

Target length: ~2:15 of footage (VO master is ~2:45; trim/space to taste). Tone: warm, confident, plain-spoken English, first person (the founder, marlburrow). No em-dashes (site rule). Voice: **MarlburroW Pro** (`zIg9jXuiKoQ2eqokLUZ8`).

Accurate to the real flow: open browser → **onboarding** (1. Identity, 2. Preferences, 3. connect one LLM) → Sherpa is seeded and comes alive → you build your team. Slow moments (docker pull, avatar generation) are covered by extra VO so you can speed those clips up in editing.

## Shot list + voiceover

| # | Time | On screen | Voiceover |
|---|------|-----------|-----------|
| 1 | 0:00–0:08 | Founder intro: KinBot logo (optional webcam) | "Hey, I'm marlburrow, the creator of KinBot. Let me show you the thing I've been building: your own team of AI agents, living entirely on your own server." |
| 2 | 0:08–0:17 | Montage: a forgetful chat vs a sidebar full of named Kins | "Most AI tools are a single chatbot that forgets you the moment you close the tab. KinBot is a whole household of specialized agents that keep their memory, work together, and grow with you over time." |
| 3 | 0:17–0:29 | Terminal: paste `docker run`, **docker pull (speed up)**, "running at localhost:3000" | "Getting started is one command. No Postgres, no Redis, no message broker. Just Bun and SQLite in a single container, so everything stays on your machine. While Docker pulls the image, that is honestly all the infrastructure you will ever need." |
| 4 | 0:29–0:41 | **Onboarding step 1 (Identity)**: first name, last name, email, pseudonym, password. **Step 2 (Preferences)**: language, color palette grid, light/dark. Show the UI recolor live when a palette is picked. | "Open your browser and KinBot walks you through a quick setup. You create your account with your name, a pseudonym and a password, pick your language, and choose a color theme. The whole interface recolors instantly to match." |
| 5 | 0:41–0:55 | **Onboarding step 3 (connect a provider)**: pick a built-in LLM, secure key field, "provider verified", then "Bringing your assistant to life…" | "Then there's the one step you can't skip: connecting an AI provider. Sherpa, your built-in assistant, needs a model to think with. You pick a provider, drop your key into a secure field, and it's stored in an encrypted vault, never in a plain config file." |
| 6 | 0:55–1:07 | Land in the app; Sherpa greets you in chat; quick glance at adding more providers / the plugin marketplace | "The moment that provider is connected, Sherpa comes to life. From here on, you mostly just talk to it. It can wire up more providers, including plugins for ones that aren't built in, and it helps you create the rest of your team." |
| 7 | 1:07–1:17 | Ask Sherpa for a Kin; create-a-Kin; **avatar generation spinner (speed up)** resolves into a robot | "Tell Sherpa what you need, and it spins up a new Kin: its own name, role, personality, and an avatar generated to match its character. Give it a moment while it paints one." |
| 8 | 1:17–1:27 | Sidebar / household grid filling with varied Kins; an inter-Kin handoff | "You can have as many as you like: a researcher, a writer, a finance helper, a home assistant, a security analyst. They each own their domain, and they hand work off to one another when a task needs more than one of them." |
| 9 | 1:27–1:34 | Scroll back through a long history; a `recall` surfacing an old memory | "And they genuinely remember you. Months later, a Kin still knows the budget you set or the preference you mentioned, because nothing is ever deleted, only summarized." |
| 10 | 1:34–1:46 | A tool rendering as a themed card (weather), then a mini-app dashboard | "When a Kin runs a tool, you don't get a wall of JSON. You get a real, themed interface: a weather card, a chart, a live dashboard. The Kins write these tools themselves, and they can build full mini-apps right inside KinBot." |
| 11 | 1:46–1:55 | Telegram message to a Kin; channel handoff to a specialist | "Your team isn't trapped in one app either. Reach them from Telegram, WhatsApp, Slack, Discord, Signal, or Matrix. Ask for a specialist by name, and the conversation is handed straight to the right Kin." |
| 12 | 1:55–2:04 | The context viewer: system-prompt breakdown + cache + per-Kin cost | "And since it all runs on your hardware, KinBot stays honest about it. You can see exactly what goes to the model, and what every turn costs, broken down by Kin and by model." |
| 13 | 2:04–2:13 | Logo, the docker command, "open source, MIT" | "It's self-hosted, open source under the MIT license, and yours to shape. That's KinBot. Spin up your own team in a couple of minutes, and show me what you build." |

## Editing notes
- **Speed up** the docker pull (scene 3) and avatar generation (scene 7) under the narration; the VO covers those waits.
- Onboarding is 3 steps (Identity → Preferences → connect one LLM). Don't show Sherpa chatting before the provider is connected; that is exactly when it is seeded ("Bringing your assistant to life…").
- Let the wow moments breathe: the palette recolor (4), Sherpa coming alive (6), avatar generation (7).
- Music: soft, warm, low, ducked under the VO. Burn in the VO as captions.
- Export a 16:9 master to `site/public/videos/install.mp4` and a poster frame to `site/public/screens/install-poster.jpg`.

## Voice generation
Lines are in `script.json` (its `voiceId` pins **MarlburroW Pro**). Run:
```bash
ELEVENLABS_API_KEY=<key> bun kinbot-video/generate-vo.mjs
```
`generate-vo.mjs` targets the voice by name ("marlburrow") and accepts `ELEVENLABS_VOICE_ID` / `ELEVENLABS_VOICE_NAME` overrides. Output: `kinbot-video/audio/scene-01..13.mp3` + `full.mp3`.
