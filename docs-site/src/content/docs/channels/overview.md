---
title: Channels Overview
description: Connect your Kins to external messaging platforms like Telegram, Discord, Slack, WhatsApp, Signal, and Matrix.
---

Channels let your Kins communicate with users on external messaging platforms. Each Kin can connect to multiple channels across different platforms, receiving messages, processing them through the AI pipeline, and responding directly on the platform.

## Supported Platforms

| Platform | Transport | Max Message | Attachments |
|----------|-----------|-------------|-------------|
| **Telegram** | Webhook | 4,096 chars | ✅ Images, files, audio, video |
| **Discord** | Gateway (WebSocket) | 2,000 chars | ✅ Images, files |
| **Slack** | Events API (webhook) | 4,000 chars | ✅ Images, files |
| **WhatsApp** | Cloud API (webhook) | 4,096 chars | ✅ Images, files |
| **Signal** | signal-cli REST API | 2,000 chars | ✅ Images, files |
| **Matrix** | Long-poll sync | 4,096 chars | ✅ Images, files |

## How Channels Work

1. **Create a channel** in the KinBot UI, selecting a platform and providing credentials (bot token, API key, etc.)
2. **Credentials are encrypted** in KinBot's vault, never stored in plain text
3. **The adapter starts** and connects to the platform (webhook, gateway, or polling)
4. **Incoming messages** are routed to the Kin's conversation queue, processed by the AI, and replies are sent back through the adapter
5. **Long messages** are automatically split at paragraph/line/sentence boundaries to respect platform limits

## Architecture

Each platform has a **channel adapter** that implements a common interface:

```
ChannelAdapter
├── start(channelId, config, onMessage)    → Connect to platform
├── stop(channelId)                         → Disconnect
├── sendMessage(channelId, config, params)  → Send outbound message
├── validateConfig(config)                  → Test credentials before saving
├── getBotInfo(config)                      → Get bot name/username for display
└── sendTypingIndicator?(channelId, config, chatId) → Show typing (optional)
```

Adapters handle platform-specific details: webhook verification, gateway heartbeats, API authentication, file uploads, and message formatting. The rest of KinBot treats all channels identically.

## Channel Tools

Kins have built-in tools for interacting with their channels:

- **`list_channels`** — List all connected channels with status and message counts
- **`list_channel_conversations`** — Discover known users and chat IDs for proactive messaging
- **`send_channel_message`** — Send a message (with optional attachments) to any connected platform

These tools are available to main agents only.

## Configuration Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `CHANNELS_MAX_PER_KIN` | 5 | Maximum channel connections per Kin |

## User Mapping & Contacts

When a user messages through a channel for the first time, KinBot can automatically create a **contact** linked to their platform identity. This enables:

- Consistent user identification across conversations
- The Kin remembering who someone is across sessions
- Proactive messaging to known users via `send_channel_message`

## Causal Chain Delivery

When a channel message triggers multi-turn processing (inter-Kin delegation, task results, wakeups), KinBot automatically delivers the final response back to the originating platform without requiring the Kin to call `send_channel_message()`.

This works through a **`channelOriginId`** that propagates through the entire causal chain: queue items, messages, tasks, inter-Kin requests/replies, and sub-Kin spawns. When processing completes, KinBot checks if the turn belongs to a channel-originated chain and delivers the response automatically.

**Auto-delivered message types:** `kin_reply`, `task_result`, `wakeup`

The Kin also receives a prompt block informing it that delivery is automatic and advising it to adapt formatting for the target platform.

| Setting | Default | Description |
|---------|---------|-------------|
| `CHANNEL_PENDING_ORIGIN_TTL` | 300000 (5min) | How long channel origin metadata is kept in memory |

## Plugin Channels

Plugins can register custom channel adapters, extending KinBot to support additional platforms beyond the built-in six. Plugin adapters use the same `ChannelAdapter` interface and are managed through the adapter registry.

## Security

- All credentials (bot tokens, API keys, signing secrets) are stored in KinBot's **encrypted vault**
- Channels support **allowlists** to restrict which chat IDs, channel IDs, or room IDs the bot responds to
- Webhook endpoints verify request signatures where the platform supports it (Slack, Telegram)
