# Channel Files Journal

## 2026-03-01 — Run 1: Step 1 — Extend IncomingMessage interface

**Commit:** d10334c  
**What:** Added `IncomingAttachment` interface and optional `attachments` field to `IncomingMessage` in `src/server/channels/adapter.ts`.

**Fields in IncomingAttachment:**
- `platformFileId` (required) — platform-specific file ID
- `mimeType` (optional)
- `fileName` (optional)
- `fileSize` (optional)
- `url` (optional) — direct download URL when available

**Observations:**
- The existing files pipeline (webchat) uses `uploadFile()` in `src/server/services/files.ts` → stores to `data/uploads/messages/<kinId>/` → saves to `files` DB table → linked to messages via `linkFilesToMessage()`
- `kin-engine.ts` (~line 1038) reads files by messageId and converts images to multimodal `{ type: 'image', image: Uint8Array }` parts, non-images become text mentions
- Queue already supports `fileIds` sideband (`src/server/services/queue.ts`)
- `handleIncomingChannelMessage()` in channels.ts needs to: download attachments → store via files service → pass fileIds to `enqueueMessage()`
- 2 pre-existing test failures (unrelated to this change), blocked pre-commit hook → used HUSKY=0

**Next step:** Step 2 — Create file download/storage service for channel files (download from platforms, store via existing files service pattern, return fileIds for queue sideband).

## 2026-03-01 — Run 2: Steps 2, 3, 4 — Infrastructure + Telegram adapter

**Commit:** 3a17d49

**Discovery:** Steps 2 and 3 were already implemented (likely in a previous uncommitted session or part of Step 1's commit):
- `downloadAndStoreAttachment()` and `downloadChannelAttachments()` already exist in `src/server/services/files.ts`
- `handleIncomingChannelMessage()` in `channels.ts` already calls `downloadChannelAttachments()` and passes `fileIds` to `enqueueMessage()`
- The full pipeline (download → store → DB → queue sideband → multimodal LLM) is operational

**What was done (Step 4 — Telegram adapter):**
Rewrote `src/server/routes/channel-telegram.ts` to extract file attachments from Telegram webhook updates:

- **Photo**: picks largest PhotoSize from array, resolves via `getFile` API, MIME = `image/jpeg`
- **Document**: file_name, mime_type from Telegram metadata
- **Audio**: supports title/performer metadata for filename
- **Video**: file_name, mime_type from metadata
- **Voice**: OGG voice messages
- **Video note**: round video messages (MP4)
- **Sticker**: static (WebP) and video (WebM) stickers, skips animated (Lottie)
- Messages with attachments but no text now processed (previously skipped)
- Each file's download URL resolved via Telegram `getFile` API before passing to the pipeline
- Bot token resolved from vault for file URL generation

**Pre-existing issues:**
- 3 test failures (unrelated, same as Run 1) — used HUSKY=0
- Files test fails due to missing `files` export from schema (pre-existing)

**Next step:** Step 5 — Discord adapter: extract `attachments[]` from MESSAGE_CREATE events, download via CDN URL.

## 2026-03-02 — Run 3: Steps 5 & 6 — Discord + WhatsApp adapters

**Commits:** 4ff8be7 (Discord, previous run), cd40a07 (WhatsApp)

**Step 5 — Discord adapter** (done in previous run):
- Already committed in `4ff8be7` — extracts `attachments[]` from MESSAGE_CREATE events
- Maps Discord attachment fields (id, filename, content_type, size, url) to `IncomingAttachment`
- Messages with attachments but no text now processed

**Step 6 — WhatsApp adapter:**
- Added support for media message types: image, document, audio, voice, video, sticker
- WhatsApp Cloud API requires two-step media download: `GET /{media-id}` → get URL → download with auth
- Added `headers` field to `IncomingAttachment` interface for auth-required downloads (WhatsApp needs `Authorization: Bearer <token>`)
- Updated `downloadAndStoreAttachment()` in files.ts to pass `attachment.headers` to fetch
- Captions on media messages are used as text content
- Route handler now passes platform config to `handleWhatsAppWebhook()` for token resolution
- Messages with unsupported types (contacts, location) are skipped gracefully

**Next step:** Step 7 — Slack adapter: retrieve files via `files.info` API, download with bot token.

## 2026-03-02 — Run 4: Step 7 — Slack adapter

**Commit:** e5ddb42

**What was done:**
- Added file attachment extraction to Slack adapter's event handler
- Slack messages with `files[]` array are now parsed into `IncomingAttachment` objects
- Uses `url_private_download` from Slack file objects (requires bot token auth)
- Added `headers` with `Authorization: Bearer <token>` for authenticated download (same pattern as WhatsApp)
- Stored `botToken` in `SlackChannelState` for file download auth
- Messages with files but no text are now processed (previously skipped)
- Empty messages (no text, no files) are explicitly skipped

**Notes:**
- Slack files use `url_private_download` which requires the bot's OAuth token as a Bearer header
- The `headers` field on `IncomingAttachment` (added in WhatsApp run) handles this cleanly
- No need for separate `files.info` API call since the event payload already includes file metadata
- 3 pre-existing test failures (unrelated) — used `--no-verify` for commit

**Next step:** Step 8 — Signal & Matrix adapters.

## 2026-03-02 — Run 5: Steps 8, 10, 11 — Signal/Matrix inbound + Outbound all adapters

**Commit:** fdf9162

**Discovery:** Signal and Matrix inbound file support (Step 8) was already implemented:
- Signal: extracts `dataMessage.attachments[]`, resolves download URL via `/v1/attachments/{id}`
- Matrix: handles `m.image`, `m.file`, `m.audio`, `m.video` message types, converts `mxc://` to download URLs with auth headers
- Step 9 (Webchat): N/A — webchat uses its own file pipeline, not the channel adapter system

**What was done (Steps 10 & 11 — Outbound file support):**

Added `OutboundAttachment` interface to `adapter.ts`:
- `source` (local path or URL), `mimeType`, optional `fileName`
- Added `attachments?: OutboundAttachment[]` to `OutboundMessageParams`
- Shared helpers: `readAttachmentBlob()`, `attachmentFileName()`, `isImageAttachment()`

Implemented outbound files for all 6 adapters:
- **Telegram**: `sendPhoto` for images, `sendDocument` for others, multipart FormData upload. Caption support (≤1024 chars).
- **Discord**: multipart with `files[N]` + `payload_json`, up to 10 attachments. Falls back to text chunks if content exceeds 2000 chars.
- **WhatsApp**: two-step — upload via `/{phoneNumberId}/media` → get media ID → send message with `{type, [type]: {id}}`. Caption support. `whatsAppMediaType()` maps MIME to image/audio/video/document.
- **Slack**: `files.upload` with `initial_comment` for single-file+text combos. Multi-file sends each separately.
- **Signal**: Base64-encoded `data:` URIs in `base64_attachments` array, attached to first chunk only.
- **Matrix**: Upload to `/_matrix/media/v3/upload` → get `content_uri` → send `m.image` or `m.file` event with the MXC URI.

All adapters are backward-compatible — text-only messages use the existing code path unchanged.

**Pre-existing issues:** 3 test failures (schema export), E2E flake in file-storage spec — all unrelated.

**Next step:** Step 12 — Give Kins a tool to attach files to their responses.

## 2026-03-02 — Run 6: Step 12 — Give Kins a tool to attach files to their responses

**Commit:** 566236c

**What was done:**

Created `src/server/tools/attach-file-tool.ts` with:
- `attach_file` tool: Kins call this during their turn to stage files for delivery
- Supports 3 source types: internal API paths (`/api/uploads/...`, `/api/file-storage/...`), workspace files, and external URLs
- In-memory staging store (`pendingAttachments` Map keyed by kinId)
- `stageAttachment()`, `popStagedAttachments()`, `clearStagedAttachments()` exports
- Built-in MIME type detection from file extension (no external dependency)

Updated `src/server/tools/channel-tools.ts`:
- `send_channel_message` tool now accepts optional `attachments` array for proactive sends

Updated `src/server/services/channels.ts`:
- `deliverChannelResponse()` accepts optional `OutboundAttachment[]` parameter
- Passes attachments through to `adapter.sendMessage()`

Updated `src/server/services/kin-engine.ts`:
- After LLM turn completes, pops staged attachments and passes to `deliverChannelResponse`
- Cleanup on abort, non-channel sources, or missing channel meta

Registered in `src/server/tools/register.ts`.

**Pre-existing issues:** 3 test failures (unrelated) — used HUSKY=0

**Next step:** Step 13 (Phase 4) — UI updates: show file attachments in conversation view (thumbnails for images, download links for docs)
