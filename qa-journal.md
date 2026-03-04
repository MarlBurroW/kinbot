# KinBot QA Journal

## 2026-03-03 04:40 UTC
### Area tested: (none - blocked)
- **Issue:** Could not access the app. Sandbox browser is disabled (`agents.defaults.sandbox.browser.enabled` is false), host browser requires Chrome extension tab attachment, and `web_fetch` blocks private IPs.
- **Action needed:** Enable sandbox browser in OpenClaw config, or attach a Chrome tab before running QA.
- **Bugs found:** 0
- **UX suggestions:** 0

### Next run
- Area 1: Onboarding / First run (once browser access is resolved)

## 2026-03-03 16:40 UTC
### Area tested: Login / Authentication
- **Pages visited:** Login page (`/`), Invalid invite page (`/invite/test-invalid-token`), Non-existent page redirect
- **Browser:** Used `openclaw` profile (headless Chromium) - works!
- **Login method:** Used JS `evaluate` to set React input values (native `type` action doesn't trigger React state updates on this app)
- **Bugs found:** 2 (issues created: #22, #23)
  - **#22 (bug):** App crashes with `TypeError: Cannot read properties of null (reading 'charAt')` when a user has no `user_profiles` row. Root cause: `UserMenu.tsx` accesses `user.firstName.charAt(0)` without null check. Affects 4 files.
  - **#23 (bug/security):** The `POST /api/auth/sign-up/email` endpoint is open to anyone, allowing unauthenticated account creation even though the UI has no sign-up form. Combined with #22, this means anyone can create accounts that crash the app.
- **UX suggestions:** 1 (issue created: #24)
  - **#24 (enhancement):** Login page missing "Forgot password?" link, loading state on Sign In button, and Enter-to-submit confirmation.
- **All clear:**
  - Invalid credentials error message is clear and well-positioned
  - Show/hide password toggle works correctly (label updates too)
  - Empty form submission handled by HTML5 validation
  - Invalid invite tokens show proper error with "Go to login" button
  - Non-authenticated routes correctly redirect to login
  - Cloudflare Turnstile is integrated (visible in page source, though may not block headless browsers)

### Next run
- Area 2: Kin management (need to login as Nicolas or create a proper test user through onboarding)
- Note: To test authenticated pages, either need Nicolas's password or a way to create users through the onboarding flow

## 2026-03-04 00:40 UTC
### Area tested: Kin Management (Create, Edit, Delete)
- **Pages visited:** Main dashboard (`/`), New Kin dialog, Edit Kin dialog (General, Tools, Memory tabs), Delete confirmation dialog, Kin chat view (`/kin/test-qa-kin`)
- **Browser:** `openclaw` profile (headless Chromium), logged in as existing user
- **Login:** Credentials from `e2e/helpers/auth.ts` (test@kinbot.local)
- **Bugs found:** 1 (issue created: #30)
  - **#30 (bug):** Import button in "New Kin" dialog does nothing when clicked. No file picker, no UI change, no error. Either the feature is broken or unimplemented without any user feedback.
- **UX suggestions:** 2 (issues created: #29, #31)
  - **#29 (enhancement):** Model selector shows ALL models from providers including non-chat models (audio, realtime, transcribe, TTS, image-only). The list is enormous and overwhelming. Should filter to chat-compatible models only.
  - **#31 (enhancement):** Slug field is only available in Edit mode, not during Kin creation. Minor QoL improvement to allow setting it upfront.
- **All clear:**
  - Create flow works well: "Describe your Kin" dialog with Generate/Create manually/Import options
  - Generate button correctly disabled until text is entered
  - Manual creation form has proper required field validation (Name, Role, Model all required, Create button disabled until filled)
  - Avatar auto-generates initials from name (e.g. "TE" for "Test QA Kin")
  - Model selector has provider filter buttons (All, Claude, OpenAI) that work correctly
  - Token count updates in real-time for Character and Expertise sections
  - Default Character and Expertise templates are helpful
  - Edit dialog has all creation fields plus Slug, and full Tools/Memory tabs
  - Tools tab shows all native tool categories with toggle switches and count (e.g. "Search 1/1", "Web Browse 3/3")
  - Tool categories are expandable to show individual tools
  - Opt-in tools (Kin Management, System, Database) are correctly off by default
  - Memory tab in edit shows search, category filter, empty state, and "Add memory" button
  - Add memory form has Content, Category dropdown (default: Fact), Subject (optional)
  - Memory save button correctly disabled until content is filled
  - Delete flow has proper confirmation dialog ("Are you sure? This will permanently delete...")
  - Delete works correctly, Kin removed from sidebar immediately
  - Chat view loads properly when selecting a Kin, with conversation starters and rich text editor
  - Kin card ordering in sidebar can be changed (drag handles present)
  - Slug auto-generated from name correctly (e.g. "test-qa-kin")

### Next run
- Area 3: Conversations (send messages, check chat UI, scroll behavior, empty states)
- Or Area 4: Tasks/Crons (create, edit, enable/disable, delete tasks)
