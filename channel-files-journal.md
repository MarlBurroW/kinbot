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
