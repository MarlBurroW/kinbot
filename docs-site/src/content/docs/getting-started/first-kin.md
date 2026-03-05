---
title: Your First Kin
description: Create your first AI agent in KinBot.
---

A **Kin** is a persistent AI agent with its own identity, memory, and tools. Unlike disposable chat sessions, a Kin remembers every conversation and builds knowledge over time.

## Creating a Kin

1. Open KinBot at `http://localhost:3000`
2. Complete the onboarding wizard (set up your admin account and first AI provider)
3. Click **New Kin** in the sidebar
4. Give it a **name**, **description**, and optionally a **system prompt**
5. Choose an AI **model** from your configured providers
6. Start chatting

## What makes a Kin?

| Property | Description |
|---|---|
| **Name** | Display name (e.g. "Research Assistant") |
| **Description** | What this Kin does |
| **System prompt** | Instructions, personality, expertise domain |
| **Model** | Which AI model to use (can be changed anytime) |
| **Avatar** | Visual identity (auto-generated or custom) |

## Key concepts

### Persistent memory

Every conversation is automatically stored. Kins extract important facts into long-term memory and can recall them later using vector similarity + full-text search.

### Session compacting

When a conversation gets long, KinBot automatically summarizes older messages to stay within token limits. Original messages are always preserved — compacting is non-destructive and reversible.

### Tools

Kins come with 100+ built-in tools out of the box: web search, memory management, file handling, sub-agent delegation, cron jobs, and more. See [Tools](/kinbot/docs/kins/tools/) for the full list.

### Collaboration

Kins can talk to each other, delegate tasks to sub-agents, and work on cron schedules. They're not isolated chatbots — they're a team.

## Next steps

- [Configure](/kinbot/docs/getting-started/configuration/) environment variables and providers
- Learn about [System Prompts](/kinbot/docs/kins/system-prompts/) for shaping Kin behavior
- Explore [Mini-Apps](/kinbot/docs/mini-apps/overview/) — interactive UIs built by Kins
- Set up [Channels](/kinbot/docs/channels/overview/) (Telegram, Discord, etc.)
