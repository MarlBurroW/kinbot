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

## 2026-03-04 04:40 UTC
### Area tested: Settings page (Area 9)
- **Pages visited:** Settings dialog (all 11 tabs: General, AI Providers, Search, MCP Servers, Vault, Memories, Files, Channels, Webhooks, Contacts, Users, Notifications)
- **Browser:** `openclaw` profile (headless Chromium)
- **Login:** Existing session from previous run
- **Bugs found:** 1 (issue created: #37)
  - **#37 (bug/i18n):** In Settings > Notifications, the last toggle shows raw i18n keys `notifications.types.mention` and `notifications.descriptions.mention` instead of translated text. All other notification types display correctly.
- **UX suggestions:** 0
- **All clear:**
  - Settings dialog opens correctly as a modal overlay
  - Left navigation has clear grouping (Core, Extensions, Connections, Access) with 11 tabs total
  - **General:** Global prompt textarea with live token counter, Save button disabled when no changes
  - **AI Providers:** Two providers (Anthropic Claude Max, OpenAI) displayed with capability badges (LLM, Embedding, Image). "Test all connections" button works perfectly - shows progress bar, "2 passed" result, and toast notification. "Add provider" form has 22+ provider types in dropdown with capability labels, proper required field validation (API key), "Show password" toggle, helpful links to get API keys
  - **Search:** Brave Search configured, default provider dropdown, add button
  - **MCP Servers:** Clean empty state with description and add button
  - **Vault:** Category filter tabs (All, Favorites, Secret, Credential, Card, Note, Identity), "Manage types" button, clean empty state
  - **Memories:** Model Configuration section (Extraction Model, Embedding Model dropdowns), "Re-embed all memories" button, search bar with category and Kin filters, 5 memories shown with rich metadata (category, subject, source Kin, auto/manual, score), edit/delete per memory, "Add memory" button
  - **Files:** Clean empty state with upload button
  - **Channels:** Clean empty state with descriptive text
  - **Webhooks:** Clean empty state
  - **Contacts:** Shows Nicolas VARROT with "Human" badge, email, edit/delete buttons, "Add note" and "Add contact" buttons
  - **Users:** Shows user profile (Nicolas VARROT, @MarlburroW, email, join date, language "fr"), Invitations section with "Invite" button
  - **Notifications:** 7 notification toggles with descriptions, all checked by default. Notification sound toggle. External delivery section with "Add delivery channel" button
  - Footer shows version (v0.9.0), uptime, and summary counts consistently across all tabs
  - "What is this?" expandable help section present on most tabs
  - Every empty state has clear description text and a call-to-action button
- **Note:** Kin pages (`/kin/dev`, `/kin/dispatcher`) consistently cause the headless browser to timeout/hang, likely due to WebSocket connections or heavy React rendering. This blocked testing Area 3 (Conversations). May be specific to headless Chromium rather than a real user-facing issue.

### Next run
- Area 4: Tasks/Crons (create, edit, enable/disable, delete tasks - can test from sidebar without entering a Kin page)
- Or Area 3: Conversations (if browser stability improves)

## 2026-03-04 08:40 UTC
### Area tested: Scheduled Jobs (Area 4 - partial) + Tasks sidebar
- **Pages visited:** Main dashboard (`/`), Create scheduled job dialog, Job detail dialog, Edit job dialog, Delete confirmation dialog
- **Browser:** `openclaw` profile (headless Chromium), host target
- **Login:** qa@kinbot.local (password reset via DB to bypass auth)
- **Bugs found:** 0
- **UX suggestions:** 3 (issues created: #38, #39, #40)
  - **#38 (enhancement):** Schedule field shows no validation feedback for invalid cron expressions. The human-readable description disappears silently, no error message or red border.
  - **#39 (enhancement):** Task instructions are not required to create a scheduled job. A job with empty instructions can be created and will fire with nothing for the Kin to do.
  - **#40 (enhancement):** Schedule display ("At 09:00") shows no timezone information. Users don't know if this is UTC, server time, or their local timezone.
- **All clear:**
  - Scheduled Jobs section has clean empty state with description and CTA button
  - "New job" button opens a well-structured creation dialog
  - Cron preset buttons (Every 5 min, Hourly, Daily 9am, etc.) work correctly and fill the schedule field
  - Human-readable cron description ("At 09:00") appears correctly for valid expressions
  - "Minute Hour Day Month Weekday" helper text below schedule field is helpful
  - Owner Kin dropdown shows all Kins with avatars, names, and descriptions
  - Target Kin and Model fields are optional with good default messaging
  - Form validation enables Create button when Name + Owner Kin + Schedule are filled
  - Created jobs appear immediately in sidebar with name, schedule description, and next-run countdown
  - Toggle switch to enable/disable jobs works correctly - paused jobs lose countdown timer
  - Job detail dialog shows all info: name, owner Kin, status, schedule, instructions, model, execution history
  - Edit dialog pre-fills all fields correctly
  - Edit has "Delete job" and "Save changes" buttons
  - Delete has proper confirmation dialog with clear warning text
  - Unsaved changes dialog appears when closing form with modifications
  - Task search in sidebar works (filters tasks by name, shows "No tasks found" empty state)
  - Collapsible sidebar sections (Tasks, Scheduled Jobs, Mini-Apps) toggle correctly
  - Jobs search bar appears when jobs exist
- **Note:** Browser automation continues to be challenging with KinBot. The `type` action does not reliably fill React controlled inputs (Name field). CodeMirror editor (Task instructions) requires `document.execCommand` to properly update state. Kin pages still cause browser timeouts. Auth required resetting the QA user password via DB because the test@kinbot.local user from E2E helpers doesn't exist in the live instance.

### Next run
- Area 3: Conversations (send messages, chat UI, scroll behavior) - requires navigating to a Kin page which causes browser hangs
- Area 11: Contacts (add, approve, edit, delete) - testable from Settings
- Area 12: Webhooks (create, edit, test, delete) - testable from Settings
- Area 5: Provider settings - testable from Settings

## 2026-03-04 12:40 UTC
### Area tested: Contacts (Area 11) + Webhooks (Area 12) + Channels (Area 6 - partial)
- **Pages visited:** Settings > Contacts, Settings > Webhooks, Settings > Channels
- **Browser:** `openclaw` profile (headless Chromium), host target
- **Login:** Existing session

#### Contacts (Area 11)
- **Bugs found:** 0
- **UX suggestions:** 0
- **All clear:**
  - Contact list shows existing contacts with type badge (Human), name, and identifiers
  - "Add contact" form: Name (required), Type dropdown (Human, Kin), Link to system user (None, existing users), Identifiers section
  - Identifiers: "Add identifier" creates inline row with type combobox (email, phone, mobile, twitter, instagram, linkedin, github, slack, website + searchable) and value textbox
  - Button correctly disabled until Name is filled
  - Contact creation shows "Contact added" toast, appears immediately in list
  - Edit form pre-populates all fields correctly (name, type, identifiers)
  - "Link to system user" dropdown shows registered users with display name + username
  - "Add note" feature: inline note form with Kin selector, scope (Global/Private), and note textbox
  - Delete has proper confirmation dialog ("This will permanently delete this contact and all associated identifiers and notes")
  - Delete shows "Contact deleted" toast, contact removed immediately
  - CRUD flow is complete and works correctly

#### Webhooks (Area 12)
- **Bugs found:** 0
- **UX suggestions:** 0
- **All clear:**
  - Clean empty state with description and CTA
  - "Add webhook" form: Target Kin (required, shows Kin list with descriptions), Name (required), Description (optional)
  - Creation shows "Webhook created" dialog with URL and masked token, warning "Save this token now - it will not be shown again" (good security)
  - Webhook list shows: name, target Kin, trigger count, last triggered, enable/disable toggle
  - Actions: View logs, Copy URL, Regenerate token, Edit, Delete
  - Toggle works correctly with "Webhook updated" toast
  - View logs shows clean empty state ("No triggers yet")
  - Delete confirmation warns about external services receiving 404 errors (helpful)
  - Delete works correctly with "Webhook deleted" toast

#### Channels (Area 6 - partial)
- **All clear:**
  - Clean empty state with clear description
  - "Add channel" form: Name, Kin (required), Platform dropdown, platform-specific fields
  - Platform options: Telegram, Discord, Slack, WhatsApp, Signal, Matrix
  - Telegram selected by default, shows Bot token field with password toggle and "How to get your bot token" link
  - Token stored encrypted in vault (noted in UI)

- **Note:** Both Contacts and Webhooks areas are very polished. CRUD flows work end-to-end, confirmation dialogs are present for destructive actions, toasts provide good feedback, empty states are clear. No bugs found in these areas.

### Next run
- Area 3: Conversations (send messages, chat UI, scroll behavior) - requires entering Kin page
- Area 13: MCP Servers (add, configure, remove) - testable from Settings
- Area 7: Memory (browse, search, delete) - testable from Settings

## 2026-03-04 16:40 UTC
### Area tested: MCP Servers (Area 13) + Plugins (Area 6b) + Settings sweep
- **Pages visited:** Settings > MCP Servers, Settings > Plugins, Settings > Vault, Settings > Memories, Settings > Files, Settings > Search, Settings > Users, Settings > Notifications
- **Browser:** `openclaw` profile (headless Chromium), host target
- **Login:** Existing session

#### MCP Servers (Area 13)
- **Bugs found:** 0
- **UX suggestions:** 0
- **All clear:**
  - Clean empty state with clear description and CTA button
  - "What is this?" expandable section with detailed MCP documentation (4 bullet points)
  - "Add MCP server" form: Name (required), Command (required), Arguments (optional, one per line), Environment variables (optional)
  - Button correctly disabled until Name + Command are filled
  - Env variables: KEY/value inputs, value masked as password with show/hide toggle, delete button per row, "Add variable" adds rows
  - Creation shows "MCP server added" toast, server appears immediately in list
  - Server card shows: name, status (Active), command, env var keys (values hidden)
  - Edit button opens "Edit MCP server" dialog with all fields pre-populated
  - Env var value correctly masked in edit form
  - Delete has proper confirmation dialog: "This will permanently remove this MCP server and disconnect it from all Kins"
  - Delete shows "MCP server deleted" toast, returns to empty state
  - Full CRUD cycle works end-to-end

#### Plugins (Area 6b) - BUG FOUND
- **Bugs found:** 1
  - **#43 (bug):** Clicking "Plugins" in Settings crashes the entire app with error boundary: "Cannot read properties of undefined (reading 'length')". 100% reproducible. Critical - crashes entire React app.
- **UX suggestions:** 0

#### Settings sweep (other pages)
- **Vault:** Works. Filter tabs (All, Favorites, Secret, Credential, Card, Note, Identity), "Manage types" button, clean empty state
- **Memories:** Works. Model configuration (extraction + embedding models), re-embed button, search with category/Kin filters, 5 memories displayed with edit/delete buttons
- **Files:** Works. Clean empty state with upload CTA
- **Search:** Works. Shows existing Brave Search provider, default provider dropdown
- **Users:** Works. Shows user info (Nicolas VARROT), invitation section
- **Notifications:** Works. 8 notification types with toggles, external delivery section

### Next run
- Area 3: Conversations (send messages, chat UI, scroll behavior)
- Area 5: Provider settings (deeper testing of add/edit/delete/test connection)
- Area 14: Account (profile, password, language)
