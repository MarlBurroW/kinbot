# KinBot Plugin: TeamSpeak

Bridges KinBot to a TeamSpeak server via the local **ts-bot** WebSocket API.

It contributes:

- **A `teamspeak` channel adapter** that ingests TeamSpeak chat messages (and,
  when wake-word transcription is enabled in ts-bot, voice transcriptions) and
  routes outgoing replies to **chat + TTS** following these rules:
  - Private message → chat only (no TTS).
  - Public channel → TTS only. **ts-bot already echoes the spoken text to the
    channel chat automatically** (so muted users can read it), so the plugin
    does NOT send a duplicate chat copy on this path.
  - Reply longer than `ttsMaxChars` → full text sent explicitly to chat +
    short TTS notice ("J'ai répondu en chat..."); ts-bot will additionally
    echo that short notice to chat.
  - When `enableTtsOnPublic = false`, public replies fall back to chat only.
- **Tools** (auto-namespaced as `plugin_teamspeak_*` by KinBot):
  - `get_status` — list channels & clients, show the bot's current location.
  - `speak` — force TTS playback in the bot's current channel.
  - `send_chat` — send a chat message to the channel or a private user.
  - `move_channel` — move the bot to another channel.
  - `stop_speaking` — interrupt ongoing TTS.

## Requirements

- KinBot **≥ 0.39.0** (uses `IncomingMessage.metadata` for structured channel context).
- A running **ts-bot** instance with its WebSocket exposed locally (default
  `ws://127.0.0.1:8080/ws`, no auth — it is meant for localhost only).

## Installation

The plugin lives at `plugins/teamspeak/` inside the KinBot repo. Restart
KinBot or click **Reload Plugins** in the UI to pick it up.

## Configuration

Open **Settings → Plugins → TeamSpeak**:

| Field | Default | Notes |
|---|---|---|
| `wsUrl` | `ws://127.0.0.1:8080/ws` | URL of the ts-bot WebSocket. |
| `defaultVoice` | _(empty)_ | TTS voice id (e.g. `ff_siwis`). Empty = ts-bot server default. |
| `ttsMaxChars` | `300` | Replies longer than this are spoken as a short notice; the full text still goes to chat. `0` disables the soft limit. |
| `enableTtsOnPublic` | `true` | Toggle TTS in public channels. Chat copy is always sent regardless. |
| `ttsTooLongNotice` | `J'ai répondu en chat, c'était trop long pour le vocal.` | Sentence spoken when the reply is too long. |
| `reconnectMaxBackoffMs` | `30000` | Upper bound for exponential reconnect backoff. |

## Usage

1. Make sure ts-bot is running and reachable.
2. In KinBot, create a channel with platform `teamspeak`. Any non-empty value
   for `wsUrl` in the per-channel config will override the plugin-level
   `wsUrl`; otherwise the plugin default applies.
3. Send a chat message in the TS channel where the bot lives — the assigned
   Kin will receive it as an incoming message with full structured context
   (modality, presence, channel, sender) in the `<channel-context>` block.

## Channel context exposed to the LLM

Each incoming message carries a `metadata` object that KinBot serializes into
the `<channel-context>` prompt block:

```jsonc
{
  "modality": "text" | "voice",
  "chatType": "public_channel" | "private",
  "channel": { "id": 5, "name": "Gaming" } | null,
  "sender":  { "uid": "<base64>", "name": "Alice", "session_id": 3 },
  "present": [{ "id": 7, "name": "Bob" }, ...] | null,
  "bot":     { "channel_id": 5, "channel_name": "Gaming" }
}
```

Voice messages additionally include `transcription = { confidence, language, duration_ms }`.

## Known limitations / POC scope

- **No automatic contact creation.** When the plugin sees a new sender it just
  logs `new sender detected: <uid>` (the plugin runtime does not yet have
  access to the per-Kin contact tools). Integration with `find_contact_by_identifier`
  is planned for v2.
- **Wake-word / mention filtering is delegated to the LLM.** The plugin
  forwards every chat message it receives. ts-bot's wake-word system handles
  the voice side; chat filtering will be refined later.
- **No native message IDs.** TeamSpeak chat has no per-message identifier, so
  the plugin synthesizes UUIDs for `platformMessageId`.
- The `sender_uid` from ts-bot arrives as a byte array (not a base64 string
  as the doc once claimed). The plugin's `normalizeUid` helper accepts both
  shapes and emits a stable base64 identifier.
- The `welcome` event is emitted with `nickname` (not `bot_nickname`); the
  client accepts either for forward compatibility.
- For `send_message` with `target = "private"`, ts-bot expects `recipient` as
  a **string** (e.g. `"11033"`). The plugin already serializes accordingly.
- The bot's `wsUrl` is unauthenticated and meant for localhost only. Don't
  expose it to the public network.
- **No KinBot `ws:*` permission scheme.** KinBot only enforces `http:<host>`
  in plugin manifests today, so this plugin only declares `storage`. A future
  KinBot release may introduce `ws:<host>:<port>` and the manifest will be
  updated then.

## Internals

- `wsClient.ts` — singleton WebSocket client (one per `wsUrl`) with:
  - Exponential reconnect (jittered, capped by `reconnectMaxBackoffMs`).
  - `command_id`-correlated request/response with 10 s timeout.
  - Smart handling of the two-phase responses ts-bot emits for `get_status`,
    `move_channel`, and `send_message` (placeholder ack → final response).
  - Broadcast event fan-out (multiple consumers can subscribe to event types).
- `index.ts` — plugin entry; wires the channel adapter, the tools, and a
  local cache of channels/clients/own_client_id maintained from
  `client_connected/disconnected/moved` plus periodic `get_status` refreshes.

## Roadmap

- [ ] Auto-create / update KinBot contacts from `sender_uid` + `sender_name`.
- [ ] Smarter chat filtering (wake-word / mention detection on chat side).
- [ ] Forward `connection_status` events as KinBot system notifications.
- [ ] Optionally relay `client_connected` / `client_disconnected` to the Kin
      as system messages for greetings.
- [ ] Populate `metadata.present` reliably (currently empty until the local
      cache is seeded by the second `get_status` response — minor bug to fix
      in `wsClient.ts` two-phase response handling for the *initial* state
      query).
- [ ] Cover the additional ts-bot commands as plugin tools when relevant
      (`poke_client`, `set_nickname`, `create_channel`, etc.).
- [ ] Live integration tests against a running ts-bot.
