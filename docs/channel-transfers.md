# Transferable channel bindings

## Concept

A KinBot channel (Telegram, Discord, Slack, WhatsApp, Signal, Matrix, TeamSpeak,
or any plugin-provided platform) is bound to exactly one Kin at a time via
`channels.kinId`. Before v0.40.x, that binding was effectively immutable: to
hand a conversation over to a different Kin you had to either run everything
through a dispatcher Kin (one extra LLM turn per inbound) or stand up a
dedicated channel per Kin.

Starting with the transferable-binding work, **the binding is mutable at
runtime**. Any Kin can call the `transfer_channel` tool to re-bind a channel
to another Kin. The bot identity on the platform side does not switch yet
(that is Issue 2, see Future work); only the KinBot routing changes.

Key invariants:

- One channel = one bound Kin at any moment.
- The bound Kin is always the one whose history receives the next inbound.
- Each Kin keeps its own conversation history. There is no shared context
  dump on transfer; the new Kin sees a short structured handoff note via
  `<channel-context>` on its first inbound, and that is it.
- No LLM turn is triggered at transfer time. The new Kin only acts when the
  user (or any external sender) sends the next message.

## The `transfer_channel` tool

Available to all main Kin agents (not sub-Kins). Not opt-in: any Kin can
hand off.

### Signature

```
transfer_channel({
  channelId?: string,        // UUID; inferred from the current turn if omitted
  targetKinSlug: string,     // slug or UUID
  reason?: string,           // optional, max 200 chars
}) -> {
  ok: true,
  transferredAt: number,
  previousKinSlug: string,
  newKinSlug: string,
} | {
  ok: true,
  noop: true,
  message: 'Channel is already bound to this Kin.',
} | {
  error: string,
}
```

### Parameters

- **`channelId`** (optional). The channel to transfer. When omitted, KinBot
  infers it from the current turn's `channelOriginId` (the causal-chain
  pointer set by the channel adapter when it enqueued the inbound that
  triggered the current turn). When the inference fails (e.g. the Kin is
  not currently serving a channel-driven turn), the tool returns a clear
  error and does nothing.
- **`targetKinSlug`**. Slug or UUID of the destination Kin. Resolved via
  `resolveKinId`. Unknown slugs return an error.
- **`reason`** (optional). Free-text rationale, capped at 200 characters by
  the Zod schema. Propagated to:
  - The audit-trail rows on both Kins (renderable in the UI).
  - The `<channel-context>` block surfaced to the new Kin on the next
    inbound.
  - The `channel:transferred` SSE event.

### Error cases

| Case | Result |
| --- | --- |
| `channelId` missing and not inferrable | `{ error: "channelId could not be inferred from the current context; please pass it explicitly." }` |
| `channelId` unknown | `{ error: 'Channel "<id>" not found.' }` |
| `targetKinSlug` unknown | `{ error: 'Kin "<slug>" not found (unknown slug or UUID).' }` |
| Source Kin row dangling | `{ error: 'Source Kin "<id>" not found; refusing to transfer from a dangling binding.' }` |
| Target row dangling after resolution | `{ error: 'Target Kin "<id>" not found after resolution; refusing to transfer to a dangling binding.' }` |
| Already bound to target | `{ ok: true, noop: true, message: '...' }` |
| `reason` over 200 chars | Rejected by Zod before `execute` runs. |

### Example invocation from a Kin

```json
{
  "name": "transfer_channel",
  "arguments": {
    "targetKinSlug": "kube-master",
    "reason": "Nicolas wants to talk to Kube Master about the cluster"
  }
}
```

The calling Kin does not need to be the channel owner; this is intentional
to support handoffs initiated by any Kin in a multi-Kin instance (e.g. a
dispatcher Kin handing off after triage, or a specialist Kin passing back
to a generalist when done).

## What the new Kin sees

On the **next inbound** that arrives on the transferred channel, the user
message metadata is enriched with a one-shot `channelTransfer` blob:

```json
{
  "fromKinId": "uuid-of-previous-kin",
  "fromKinSlug": "kinbot-master",
  "fromKinName": "KinBot Master",
  "reason": "Nicolas wants to talk to Kube Master about the cluster",
  "at": 1778534324654
}
```

The kin-engine surfaces this in the existing `<channel-context>` XML tag
that already carries the adapter-supplied channel info, sharing a single
JSON envelope:

```
<channel-context>
{"channel": {...}, "channelTransfer": {"fromKinSlug": "kinbot-master", "fromKinName": "KinBot Master", "reason": "...", "at": 1778534324654}}
</channel-context>
```

The hint is **one-shot**: after the first inbound consumes it, subsequent
inbounds carry only the regular `channel` block. The hint lives in an
in-memory sideband (`channelTransferHints` in
`src/server/services/channels.ts`); it is lost on restart, which is
deliberate (a stale post-restart hint would be misleading, while losing
one is harmless because the durable audit-trail rows below survive).

## UI audit trail

The transfer writes two rows into the `messages` table, one per Kin:

| kin     | role     | sourceType | metadata.systemEvent          | metadata payload                                            |
| ------- | -------- | ---------- | ----------------------------- | ----------------------------------------------------------- |
| source  | `system` | `system`   | `channel_transferred_out`     | channelId, channelName, targetKinId/Slug/Name, reason, at   |
| target  | `system` | `system`   | `channel_transferred_in`      | channelId, channelName, fromKinId/Slug/Name, reason, at     |

Both rows have `content: null`. The UI is expected to recognize them by
the `metadata.systemEvent` discriminator and render a handoff banner card
("Channel handed off to <target> — reason: ...").

`buildMessageHistory` filters these rows out before assembling the LLM
prompt: they exist purely for the human-readable history view and would
only confuse the model with redundant information that is already conveyed
by the `<channel-context>` hint described above.

## SSE event

The tool broadcasts a `channel:transferred` event (visible to every open
client) so any UI tab showing a Kin sidebar or the channel page can
refresh the binding badge in real time:

```json
{
  "type": "channel:transferred",
  "data": {
    "channelId": "...",
    "channelName": "...",
    "fromKinId": "...",
    "fromKinSlug": "...",
    "fromKinName": "...",
    "toKinId": "...",
    "toKinSlug": "...",
    "toKinName": "...",
    "reason": "..." | null,
    "at": 1778534324654
  }
}
```

It is intentionally broadcast (not `sendToKin`) because multiple Kin views
may be open and several need to refresh at once.

## Migration

None required. The existing `channels.kinId` column is the same column;
only its mutability semantics changed. Pre-existing channels keep working
unchanged. No DB migration, no data backfill.

The decision to keep `channels.kinId` as the source of truth (rather than
introducing a separate "current Kin" pointer or a binding-history table)
was deliberate: the audit-trail rows give us the history view; the live
binding is just whatever `channels.kinId` currently says.

## Future work (out of scope for this commit)

- **Issue 2: Adapter identity switch.** When a channel transfers, the bot
  identity exposed to the external platform (display name, avatar) should
  follow the new Kin where the adapter supports it. The plan is an
  optional `onIdentityChange(identity)` hook on `ChannelAdapter`. For
  adapters that cannot switch identity (SMS, classic webhook-only setups),
  a prefix fallback ("[Kube Master] ...") will be injected by the core
  before delivering outbound replies.
- **Issue 3: UI badges.** The sidebar Kin rows and the channel page need
  visible binding badges, and a transfer-history surface (filterable by
  channel or by Kin) so the user can audit past handoffs. The SSE event
  and the audit-trail rows added here are the foundation; the UI work
  consumes them.

Both follow-ups are independent of each other and of this issue, and can
be implemented in either order.
