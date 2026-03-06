---
title: What are Kins?
description: Understanding KinBot's persistent AI agents.
---

Kins are KinBot's core concept: **persistent AI agents** that live on your server, remember everything, and work as a team.

Unlike disposable chatbot sessions, a Kin has:

- **A permanent identity** — name, role, personality, expertise, avatar
- **Continuous memory** — every conversation is remembered forever through vector + full-text search
- **A continuous session** — there's no "new conversation"; the session never resets
- **Collaboration skills** — Kins talk to each other, delegate tasks, and spawn sub-agents
- **Autonomy** — cron jobs, webhooks, and channel integrations let them work while you sleep

## Anatomy of a Kin

When you create a Kin, you define:

| Field | Purpose |
|---|---|
| **Name** | Display name (e.g. "Atlas") |
| **Slug** | Unique identifier for inter-Kin communication (e.g. `atlas`) |
| **Role** | One-line description of what it does (e.g. "Infrastructure specialist") |
| **Character** | Personality traits and communication style |
| **Expertise** | Domain knowledge and capabilities |
| **Model** | Which LLM to use (from your configured providers) |
| **Avatar** | Visual identity in the UI |

## How they work

1. **Messages queue** — each Kin has its own FIFO queue. User messages have priority over automated ones (cron, webhooks, inter-Kin).
2. **System prompt** — KinBot builds a rich system prompt from the Kin's identity, relevant memories, contacts directory, Kin directory, active channels, and platform directives.
3. **Memory injection** — before each turn, relevant memories are retrieved via semantic search and injected into context.
4. **Session compacting** — when the conversation gets too long for the model's context window, older messages are summarized. Originals are always preserved and the process is rollback-able.
5. **Tool execution** — Kins have access to 100+ built-in tools plus MCP servers and custom tools.

## Shared Kins

All users on the instance interact with the same Kins. Each message is tagged with the sender's identity, so the Kin knows who it's talking to.

## The Hub

You can designate one Kin as the **Hub** — a central coordinator that receives all incoming requests and routes them to the most appropriate specialist Kin. The Hub gets an enriched directory view with expertise summaries and active channel information.

## What's next?

- [System Prompts](/kinbot/docs/kins/system-prompts/) — craft the perfect personality
- [Tools](/kinbot/docs/kins/tools/) — give your Kins capabilities
- [Memory](/kinbot/docs/kins/memory/) — how Kins remember
