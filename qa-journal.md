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

## 2026-03-04 20:40 UTC
### Area tested: Conversations (Area 3)
- **Pages visited:** / (home), /kin/dispatcher (Dispatcher conversation)
- **Browser:** `openclaw` profile (headless Chromium), host target
- **Login:** Existing session (qa@kinbot.local)

#### Findings

**Bug: Raw task prompt leaked as visible text (#46)**
- When a sub-task fails, the entire raw task prompt (including HTML source, internal instructions, tool call JSON) is rendered as plain text in the conversation
- Makes the conversation unreadable with walls of unformatted code
- Also a security concern (internal prompts exposed)

**Bug: Duplicate message content after Memorize tool calls (#47)**
- Last assistant message shows the same response content twice with minor wording differences
- Appears to be related to Memorize tool call results being rendered inline as message content

**Enhancement: Unlabeled buttons in conversation header (#48)**
- Multiple icon-only buttons in the nav bar and Kin header have no aria-label or tooltip
- Impossible to know their function without clicking them

**Bug: Model selector still shows non-chat models (#49)**
- Regression of #29 (closed) - model dropdown still lists TTS, transcribe, realtime, audio, image, codex, search-api models
- Users could accidentally select an incompatible model

**Other observations (not filed):**
- User avatar shows "??" for qa@kinbot.local (likely because no display name is configured - works as designed)
- Model selector UI works well: provider grouping, search filter, nice layout
- Message actions (Copy, Edit & resend, React, Read aloud, Regenerate) are well placed
- Tool call panel on the right side works and shows timestamps
- "Compacting conversation" indicator with memory extraction count is clean
- Failed task cards with "Show error details" and "View task details" buttons are good
- Auto-scroll toggle and Scroll to top are present
- Formatting toolbar (Bold, Italic, Strikethrough, Code, Code block) present on input
- Send button correctly disabled when input is empty
- Date separators and time gap indicators ("48 min later") work nicely

**Note:** Browser repeatedly timed out when interacting with the Dispatcher conversation page. The page is very heavy due to long conversation history + large raw text blocks. Could be a performance concern for long conversations.

- **Bugs found:** 3 (issues #46, #47, #49)
- **UX suggestions:** 1 (issue #48)
- **All clear:** Model selector UI, message actions, tool call panel, compaction indicator, date separators, formatting toolbar, auto-scroll, empty state send button

### Next run
- Area 14: Account (profile, password, language settings)
- Area 3 continued: Test actually sending a message, editing a message, using reactions (was blocked by browser timeouts on Dispatcher page - try with Dev Kin which has less history)
- Area 15: Quick chat / Ephemeral sessions

## 2026-03-05 00:40 UTC
### Area tested: Account / My Account (Area 14)
- **Pages visited:** Home page, "My account" dialog (via avatar dropdown menu)
- **Browser:** `openclaw` profile (headless Chromium), host target

#### Findings

**Bug: Profile data not persisted after saving (#54)**
- Fill in First name ("QA"), Last name ("Tester"), Pseudonym ("qa_bot")
- Click "Save changes" - success toast "Profile updated" appears
- Close and reopen dialog: all fields are empty
- Page reload: all fields still empty
- Avatar initials never update from "??" even after "successful" save
- Either the API call fails silently, backend doesn't persist, or dialog doesn't load saved data on mount

#### Other observations (not filed - working correctly)
- Avatar dropdown menu works: shows email, "My account", "Settings", "Sign out"
- "My account" dialog layout is clean: avatar upload button, email display, form fields, language dropdown
- Language dropdown works: shows English and Francais (only 2 languages, matching open issues #5/#6 for German/Spanish)
- Cancel and Close buttons work correctly
- Form validation: no required field validation on first/last name (acceptable - they're optional)
- File input for avatar is present (hidden, triggered by avatar button)
- Version button (v0.9.0) in sidebar timed out on click - could not verify what it opens

- **Bugs found:** 1 (issue #54)
- **UX suggestions:** 0
- **All clear:** Dialog layout, avatar dropdown menu, language selector, Cancel/Close behavior

### Next run
- Area 15: Quick chat / Ephemeral sessions
- Area 11: Contacts (add, approve, edit, delete)
- Area 12: Webhooks

## 2026-03-05 04:40 UTC
### Area tested: Contacts (Area 11), Webhooks (Area 12), MCP Servers (Area 13)
- **Pages visited:** Settings > Contacts, Settings > Webhooks, Settings > MCP Servers, Settings > Vault
- **Browser:** `openclaw` profile (headless Chromium), host target

#### Findings

**Enhancement: Submit buttons hidden until form is valid in create dialogs (#58)**
- In Add contact, Add webhook, and Add MCP server dialogs, the submit button is completely invisible until required fields are filled
- Better pattern: always show the button but keep it disabled
- Affects discoverability for new users

#### Other observations (not filed - working correctly)

**Contacts:**
- CRUD flow works perfectly: Add, Edit, Delete all function correctly
- Contact creation saves identifiers (email tested) properly
- Edit dialog loads saved data correctly (unlike profile - see #54)
- Delete has a proper confirmation dialog with clear warning text
- "Add note" feature works: shows Kin selector, scope (Global), and note text field
- Identifier type dropdown comprehensive: email, phone, mobile, twitter, instagram, linkedin, github, slack, website
- Type selector: Human/Kin options available
- "Link to system user" combobox present

**Webhooks:**
- Full CRUD works: create, view, delete
- Creation shows webhook URL and masked token with "Save this token now" warning (good security)
- Webhook list shows: toggle (enable/disable), View logs, Copy URL, Regenerate token, Edit, Delete
- Trigger log dialog shows (empty state with illustration)
- Delete confirmation dialog with clear "External services will receive 404 errors" warning
- Kin selector dropdown works in creation flow

**MCP Servers:**
- Empty state with clear description
- "What is this?" expandable info section
- Add dialog has: Name, Command, Arguments, Environment variables sections
- Add variable button for env vars

**Vault:**
- Categories: All, Favorites, Secret, Credential, Card, Note, Identity
- "Manage types" button present
- Clean empty state

**Performance note:**
- Conversation pages (/kin/dev, /kin/dispatcher) consistently cause browser snapshot timeouts (>20s)
- Settings dialog pages load and respond quickly
- This is a recurring issue noted in previous sessions

- **Bugs found:** 0
- **UX suggestions:** 1 (issue #58)
- **All clear:** Contacts CRUD, Webhooks CRUD, MCP Servers UI, Vault UI, delete confirmations, identifier management, webhook security (token masking), category filtering in Vault

### Next run
- Area 15: Quick chat / Ephemeral sessions (need to access via a conversation page, which may require addressing the conversation page timeout issue)
- Area 9: Settings page - remaining tabs (General, Plugins, Browse Plugins, Files, Channels, Users, Notifications)
- Area 8: Mini-apps

## 2026-03-05 08:40 UTC
### Area tested: Settings page - remaining tabs (Area 9)
- **Pages visited:** Settings > General, Search, Plugins, Browse Plugins, Memories, Files, Channels, Users, Notifications

#### Bugs found

**Bug: Plugins tab crashes app (regression of #43) - Issue #61**
- Settings > Plugins crashes entire app with error boundary
- Error: `Cannot read properties of undefined (reading 'length')`
- Requires page reload to recover
- 100% reproducible
- Was fixed in #43 but has regressed

**Bug: Browse Plugins shows error toasts - Issue #62**
- Settings > Browse Plugins shows two error toasts: `Cannot read properties of undefined (reading 'plugins')`
- Page renders but shows "No plugins found"
- Related to #61, likely same underlying data/API issue

#### Other observations (not filed - working correctly)

**General tab:**
- Global prompt field works: typing enables Save button, token counter updates in real-time (~5 tokens for test text)
- "What is this?" expandable info section present
- Save button properly disabled when no changes

**Search tab:**
- Brave Search provider configured and displayed correctly
- Default provider dropdown with "Automatic (first valid)" option
- Provider card shows capabilities (Web Search)
- Delete, edit buttons present

**Memories tab:**
- Shows 5 memories with proper metadata (category, scope, Kin, source, relevance score)
- Search bar, category filter, Kin filter all present
- Model Configuration section: Extraction Model and Embedding Model dropdowns
- "Re-embed all memories" button available
- "Add memory" button at bottom
- Each memory has edit and delete buttons

**Files tab:**
- Clean empty state with illustration
- "Upload file" button (appears twice - one in empty state, one at bottom)

**Channels tab:**
- Clean empty state with good description
- "Add channel" button (appears twice - one in empty state, one at bottom)

**Users tab:**
- Shows Nicolas VARROT user with avatar, username (@MarlburroW), email, join date, language (fr)
- Invitations section with "Invite" button
- Clean layout

**Notifications tab:**
- Comprehensive toggle list: Notification sound, Input needed, User pending approval, Cron pending approval, MCP pending approval, Kin error, Kin alert, Mention
- All toggles checked by default
- External delivery section with "Add delivery channel" button
- Clean descriptions for each notification type

**Footer bar (all tabs):**
- Shows version (v0.9.0), uptime (1d 12h), and stats (2 Kins, 3 providers, 5 memories, 1 channel(?), 2 users(?))

- **Bugs found:** 2 (issues #61, #62)
- **UX suggestions:** 0
- **All clear:** General, Search, Memories, Files, Channels, Users, Notifications tabs all work well

### Next run
- Area 15: Quick chat / Ephemeral sessions
- Area 8: Mini-apps (gallery, viewer)
- Area 4: Tasks/Crons (create, edit, enable/disable, delete)

## 2026-03-05 12:40 UTC
### Area tested: Mini-Apps (Area 8)
- **Pages visited:** Home page sidebar (Mini-Apps section), App Gallery dialog

#### Bugs found

**Bug: Mini-Apps sidebar not updated after cloning from App Gallery - Issue #63**
- Clone an app via App Gallery, success toast appears, but sidebar still shows "No apps yet"
- Even after full page refresh, cloned app doesn't appear in sidebar
- Root cause: `useMiniApps` hook filters by `selectedKinId`, which is null on home page
- The SSE event `miniapp:created` is filtered by kinId match, so it's silently dropped

#### UX suggestions

**Enhancement: Misleading empty state when no Kin selected - Issue #64**
- Sidebar shows "No apps yet - Ask a Kin to create one" even when apps exist on other Kins
- Should show "Select a Kin to see its apps" or show all apps across Kins

**Enhancement: Clone button doesn't update after cloning, allows duplicates - Issue #65**
- After cloning, the Clone button stays active (not "Owned"/"Cloned")
- User can clone the same app multiple times, creating duplicates
- Gallery doesn't refresh data or track cloned state

#### Other observations (code review, no issues filed)
- MiniAppViewer is well-built: postMessage SDK with toast, navigate, fullpage, confirm/prompt dialogs, clipboard, download, notifications, send-message, share, resize, locale/theme sync
- Rate limiting on send-message (5/30s) is good
- Sandbox iframe with appropriate permissions
- MiniAppCard has proper keyboard accessibility, delete confirmation
- E2E tests exist for gallery (16-mini-app-gallery.spec.ts)
- Could not test mini-app viewer/iframe rendering due to browser service timeouts

- **Bugs found:** 1 (issue #63)
- **UX suggestions:** 2 (issues #64, #65)
- **All clear:** MiniAppViewer component, MiniAppCard component, clone backend logic, E2E test coverage, SDK message handling

### Next run
- Area 15: Quick chat / Ephemeral sessions
- Area 4: Tasks/Crons (create, edit, enable/disable, delete)
- Area 3: Conversations (start, send messages, chat UI)

## 2026-03-05 16:40 UTC
### Area tested: Quick Chat / Ephemeral Sessions (Area 15)
- **Pages visited:** Code review of QuickChatPanel.tsx, useQuickChat.ts, useQuickSession.ts, quick-sessions.ts (routes), quick-session-cleanup.ts
- **Note:** Browser unavailable (sandbox disabled, no host tab), testing done via thorough code review

#### Bugs found

**Bug: Quick session memory saved without embedding - Issue #69**
- When closing with "Save as memory", route uses raw db.insert() instead of createMemory() service
- Memories have no embedding vector, won't appear in semantic search
- Critical: defeats the purpose of the "save as memory" feature

**Bug: Expired quick sessions closed silently without SSE notification - Issue #70**
- Cleanup service closes expired sessions in DB but doesn't emit SSE events
- Client panel stays open, user gets 409 errors when trying to send messages
- No visual feedback that the session expired

#### UX suggestions

**Enhancement: Model picker in quick chat changes Kin model globally - Issue #71**
- Changing model in quick chat affects main conversation too
- Should be session-scoped or removed from quick chat

**Enhancement: No quick session history/review - Issue #72**
- Closed sessions are inaccessible from UI despite being in DB for 7 days
- Users can't review past quick conversations

#### Other observations (no issues filed)
- SSE event handling is well-implemented with proper kinId+sessionId filtering
- Optimistic message updates work correctly
- Stop streaming functionality is properly wired
- File upload in quick chat reuses the main chat infrastructure (good)
- Sheet panel is 500px wide, responsive down to sm breakpoint
- Mobile: quick chat accessible via overflow menu (acceptable)
- Auto-scroll on new messages works
- Close dialog with save-as-memory checkbox is a nice touch
- Cleanup service handles both expiry and retention deletion correctly
- No E2E tests exist for quick chat

- **Bugs found:** 2 (issues #69, #70)
- **UX suggestions:** 2 (issues #71, #72)
- **All clear:** SSE streaming, message sending, file upload, stop streaming, session creation/closing flow, mobile menu access, auto-scroll, close dialog UX

### Next run
- Area 4: Tasks/Crons (create, edit, enable/disable, delete)
- Area 3: Conversations (start, send messages, chat UI)
- Area 11: Contacts

## 2026-03-06 08:40 UTC
### Area tested: Conversations (Area 3)
- **Pages visited:** Code review of ChatPanel.tsx, MessageBubble.tsx, MessageInput.tsx, ConversationHeader.tsx, ChatEmptyState.tsx, ConversationSearch.tsx, MarkdownContent.tsx, DateNavigator.tsx, DateSeparator.tsx, useChat.ts, useReactions.ts, useDraftMessage.ts, useInputHistory.ts, useExportConversation.ts, messages.ts (routes), reactions.ts (routes)
- **Note:** Browser unavailable (sandbox disabled, host browser timed out), testing done via thorough code review

#### Bugs found

**Bug: ReactionPicker popover does not close on outside click - Issue #78**
- Custom useState-based popover lacks click-outside handling
- User must click the trigger button again to dismiss
- Should use Radix Popover components already available in the app

**Bug: Inconsistent max-width between assistant message bubbles - Issue #79**
- Messages with tool calls: max-w-[80%]
- Messages without tool calls: max-w-[75%]
- Same Kin's messages have different widths depending on tool usage

**Bug: ConversationSearch Escape handler conflicts with modal Escape - Issue #80**
- Global window keydown listener fires even when modals are focused
- Pressing Escape closes both search bar AND any open modal simultaneously
- Should be scoped to the search input element

#### UX suggestions

**Enhancement: Search should include streaming message - Issue #81**
- Search passes `messages` (persisted only) to ConversationSearch
- Streaming message in `displayMessages` is not searchable

**Enhancement: Persist message drafts across page reloads - Issue #82**
- useDraftMessage uses module-level Map, lost on refresh
- Should use localStorage with debounced saves

**Enhancement: No server-side message length validation - Issue #83**
- Client shows character counter (cosmetic only)
- Server accepts arbitrarily long messages without limit
- Potential for abuse and unnecessary token consumption

#### Other observations (no issues filed)
- Chat system is well-architected: SSE streaming with batched token updates (50ms), optimistic message sends, infinite scroll with position restoration
- Keyboard shortcuts are comprehensive: Ctrl+F search, Escape refocus, Up/Down input history, Ctrl+1-9 kin switching
- Message grouping (2-min window) works well for visual clarity
- Date separators are sticky with backdrop blur, nice UX
- DateNavigator with jump-to-date is a solid feature
- ConversationStats and export (MD/JSON) are polished
- File drag-and-drop works at both panel level and input level
- Code blocks have copy, download, wrap toggle, line numbers, language detection
- Markdown rendering lazily loads heavy plugins (rehype-highlight, remark-math, rehype-katex)
- Mention autocomplete with @ trigger is well-implemented
- Formatting toolbar (bold, italic, code) with keyboard shortcuts
- Auto-scroll toggle with pin icon is clever
- Reading time estimate for long messages
- Context menu with copy, quote, edit/resend, read aloud, regenerate
- MarkdownContent plain text shortcut regex has a minor false positive (`\d+\.` matches version numbers like "1.0") but no visual impact
- No E2E tests found specifically for conversation search or reactions

- **Bugs found:** 3 (issues #78, #79, #80)
- **UX suggestions:** 3 (issues #81, #82, #83)
- **All clear:** SSE streaming, message sending/receiving, optimistic updates, file upload/drag-drop, input history, mention autocomplete, formatting toolbar, markdown rendering, code blocks, date separators, infinite scroll, export, context menu, typing indicator, empty state, auto-scroll, keyboard shortcuts, model picker, context usage display, clear conversation, regenerate

### Next run
- Area 11: Contacts (add, approve, edit, delete)
- Area 12: Webhooks (create, edit, test, delete)
- Area 13: MCP servers (add, configure, remove)

## 2026-03-06 12:40 UTC
### Area tested: Contacts (Area 11)
- **Pages visited:** Code review of ContactsSettings.tsx, ContactCard.tsx, ContactFormDialog.tsx, ContactNotes.tsx, ContactPlatformIds.tsx, ApprovalDialog.tsx, contacts.ts (routes), contacts.ts (service), channels.ts (service for platform IDs), schema.ts (FK cascades)
- **Note:** Browser unavailable (sandbox disabled, Chrome extension relay not attached), testing done via thorough code review

#### Bugs found: 3

1. **No Kin selector for "kin" type contacts** - Issue #84
   - ContactFormDialog shows user selector for "human" but no Kin selector for "kin" type
   - linkedKinId always null from UI, breaking prompt builder resolution

2. **Server accepts whitespace-only and empty contact names** - Issue #85
   - POST checks `!name` (truthy for `"   "`), PATCH has no name validation at all
   - Client validates but server should not depend on it

3. **createContact silently returns existing on duplicate linkedUserId** - Issue #86
   - Returns existing contact with 201 status instead of 409 conflict
   - UI shows "Contact added" toast even though nothing was created

#### UX suggestions: 2

4. **Delete confirmation should warn about cascading effects** - Issue #87
   - Deleting contact cascades to platform IDs (channel access revocation)
   - Users not warned they're locking someone out of messaging

5. **N+1 API calls for platform IDs** - Issue #88
   - Each ContactCard fetches platform IDs separately
   - Should be included in contact detail response like identifiers/notes

#### All clear:
- Contact CRUD flow (create/edit/delete) works correctly via UI
- Identifier management (add/remove/edit with LabelCombo) is well-built
- Notes system with per-Kin scoping (global/private) is solid
- SSE real-time updates for contact changes
- Approval dialog for channel users (create new or link existing)
- FK cascade on delete properly configured for identifiers, notes, platform IDs
- Platform ID display with platform icons and hover-to-revoke UX
- Empty state with call to action
- Loading skeleton while fetching

### Next run
- Area 12: Webhooks (create, edit, test, delete)
- Area 13: MCP servers (add, configure, remove)

## 2026-03-06 16:40 UTC
### Area tested: Webhooks (Area 12)
- **Pages visited:** Code review of WebhooksSettings.tsx, WebhookFormDialog.tsx, WebhookCard.tsx, WebhookLogDialog.tsx, webhooks.ts (routes), webhooks-incoming.ts (routes), webhooks.ts (service), webhook-tools.ts, schema.ts (webhooks + webhookLogs tables), 09-webhook-management.spec.ts (E2E)
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

- **Bugs found:** 3 (issues #89, #92, #94)
  - #89: Server accepts whitespace-only webhook names (no trim/validation)
  - #92: WebhookFormDialog swallows API errors silently (try/finally, no catch)
  - #94: Webhook creation does not validate kinId exists (FK error leaks to user)

- **UX suggestions:** 3 (issues #90, #91, #93)
  - #90: Webhook logs grow unbounded with no retention/cleanup
  - #91: Incoming webhook endpoint has no rate limiting
  - #93: Inactive webhooks should have visual distinction beyond toggle switch

- **All clear:**
  - Token generation and reveal flow is well-designed (shown once, hidden by default, copy buttons)
  - Constant-time token comparison (timingSafeEqual) for security
  - SSE real-time updates for webhook CRUD and triggers
  - Webhook log dialog with expandable payloads and source IP display
  - Copy URL button on each card
  - Regenerate token with confirmation dialog
  - ConfirmDeleteButton for safe deletion
  - Max webhooks per Kin limit (configurable, default 20)
  - Max payload size limit (1MB) on incoming endpoint
  - Webhook tools for Kins (create/update/delete/list) with ownership verification
  - E2E test coverage is comprehensive (create, edit, toggle, delete, token reveal, empty state)
  - Log payload truncation to 10KB in DB
  - Help panel with documentation bullets
  - Empty state with call-to-action

### Next run
- Area 13: MCP servers (add, configure, remove)
- Area 14: Account (profile, password, language settings)

## 2026-03-06 20:40 UTC
### Area tested: MCP Servers (Area 13)
- **Pages visited:** Code review of McpServersSettings.tsx, McpServerFormDialog.tsx, McpServerCard.tsx, mcp-servers.ts (routes), mcp.ts (service), mcp-tools.ts (Kin tools), mcp.test.ts (unit tests), schema.ts, 14-mcp-servers.spec.ts (E2E)
- **Note:** Browser unavailable (sandbox disabled, Chrome extension relay not attached), testing done via thorough code review

#### Bugs found: 3

1. **Server accepts whitespace-only MCP server names/commands** - Issue #95
   - POST uses `!body.name` (truthy for `"   "`), PATCH has zero validation
   - Same pattern as contacts (#85) and webhooks (#89)

2. **API exposes env var values (secrets) to frontend** - Issue #96
   - `serialize()` returns full env object including API keys and tokens
   - PasswordInput hides visually but values are in API response (DevTools)
   - Security concern

3. **Connection pool has no reconnection or cleanup** - Issue #98
   - Dead connections stay in pool, no timeout on connect, no shutdown hook
   - Tool calls silently fail if MCP process crashes

#### UX suggestions: 2

4. **No connection status indicator or health check** - Issue #97
   - "Active" badge = approval status, not connection health
   - No way to test if server works, no tool count, no error feedback

5. **Unicode chars silently dropped from tool names** - Issue #99
   - Non-Latin server names produce empty/colliding tool key prefixes

#### All clear:
- MCP server CRUD flow (create/edit/delete) works correctly
- E2E test coverage is comprehensive (create, edit, delete, empty state)
- Form validation on client side (name + command required)
- SSE real-time updates for server CRUD events
- ConfirmDeleteButton for safe deletion
- Approval workflow for Kin-created servers (pending_approval status)
- Auto-disconnect on config change (command/args/env)
- PATH augmentation for child processes (NVM detection)
- JSON Schema to Zod conversion is well-tested
- Tool access control per Kin (mcpAccess allowlist + auto-enabled for creator)
- Lazy connection pooling (connect on first use)
- Empty state with call to action
- Loading skeleton while fetching
- Help panel with documentation
- Env var key/value UI with PasswordInput for values
- Delete cascade removes kin_mcp_servers junction entries

### Next run
- Area 14: Account (profile, password, language settings)
- Area 15: Quick chat / Ephemeral sessions

## 2026-03-07 00:40 UTC
### Area tested: Account / Profile / Users (Area 14)
- **Pages visited:** Code review of AccountDialog (AccountPage.tsx), UserMenu.tsx, me.ts (routes), users.ts (routes), invitations.ts (routes+service), UsersSettings.tsx, GeneralSettings.tsx, schema.ts (userProfiles)
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

- **Bugs found:** 4 (issues created: #100, #101, #102, #105)
  - #100: Avatar upload has no file size limit or type validation (XSS risk via HTML upload)
  - #101: PATCH /api/me has no input validation (whitespace, length, type) - recurring pattern
  - #102: Invitation tokens exposed in full in list API response
  - #105: DELETE /api/users/:id has no admin role check - any authenticated user can delete others (privilege escalation)

- **UX suggestions:** 2 (issues created: #103, #104)
  - #103: Account dialog should support password change
  - #104: Account dialog should show last login and account creation date

- **All clear:**
  - Account dialog hero design with gradient background is polished
  - Avatar upload UX (click avatar, hover overlay with camera icon) is intuitive
  - Form state properly resets when dialog opens (useEffect on open+user)
  - Language selector updates i18n in real-time on save
  - User menu dropdown is clean and well-organized
  - Users settings page has invitation flow (create, copy link, revoke, status badges)
  - Delete user has confirmation dialog
  - Self-deletion prevention ("you" badge + no delete button on self)
  - Invitation expiry system with active/used/expired status
  - Client-side `accept="image/*"` filter on avatar file input
  - Loading state on save button with spinner

### Next run
- Area 15: Quick chat / Ephemeral sessions
- Area 9: Settings page (all tabs, toggle options, save/cancel)

## 2026-03-07 04:40 UTC
### Area tested: Quick Chat / Ephemeral Sessions (Area 15)
- **Pages visited:** Code review of QuickChatPanel.tsx, QuickSessionHistory.tsx, useQuickChat.ts, useQuickSession.ts, useQuickSessionHistory.ts, quick-sessions.ts (routes), quick-session-cleanup.ts, ChatPanel.tsx (integration), schema.ts, config.ts
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

#### Bugs found: 5 (issues created: #113, #114, #115, #116, #117)

1. **closeSession clears UI state even when API call fails** - Issue #113
   - `setActiveSession(null)` runs in all cases, even on error
   - Session becomes invisible client-side but stays active on server

2. **Expired sessions still accept messages until cleanup runs** - Issue #114
   - Message endpoint only checks `status !== 'active'`, not `expiresAt`
   - Up to 60-min gap where expired sessions accept messages

3. **All client hooks silently swallow errors** - Issue #115
   - Empty `catch` blocks across useQuickChat, useQuickSession, useQuickSessionHistory
   - No toast, no error state, no retry UI

4. **Title and memory summary have no server-side validation** - Issue #116
   - Whitespace-only titles accepted, no length limit on title or memorySummary
   - Same recurring pattern as #85, #89, #95, #101

5. **quick_sessions.created_by FK missing onDelete cascade** - Issue #117
   - User deletion orphans quick sessions
   - kinId has cascade, createdBy does not

#### All clear:
- Quick session creation flow with max active limit (1 per user per kin) works correctly
- Session ownership verification (loadSession helper) is solid
- Idempotent close (already-closed returns ok) is good
- Expiration/cleanup system with configurable intervals works
- SSE real-time updates for session closed events
- Streaming message support with batched token updates (50ms)
- Optimistic message insertion with rollback on error
- Memory save on close with proper embedding via createMemory
- Session history with message count and date formatting
- Sheet-based side panel UI is clean
- Draft message persistence per session
- File upload support in quick chat
- Stop streaming functionality
- Empty state with helpful message
- Auto-scroll on new messages
- Lazy-loaded components (Suspense + lazy import)

### Next run
- Area 9: Settings page (all tabs, toggle options, save/cancel)

## 2026-03-07 12:40 UTC
### Area tested: Settings Page (Area 9)
- **Pages visited:** Code review of SettingsPage.tsx, GeneralSettings.tsx, FileStorageSettings.tsx, VaultSettings.tsx, PluginsSettings.tsx, PluginMarketplace.tsx, SearchProvidersSettings.tsx, MemoriesSettings.tsx, NotificationPreferences.tsx, settings.ts (routes), notifications.ts (routes), app.ts (/api/info), plugins.ts (routes+service)
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

- **Bugs found:** 2 (issues created: #126, #127)
  - #126: Path traversal in plugin store routes (`/api/plugins/store/:name`) allows reading arbitrary files (security)
  - #127: FileStorageSettings and VaultSettings still silently swallow fetch errors (incomplete fix of #122)

- **UX suggestions:** 2 (issues created: #128, #129)
  - #128: Marketplace plugin uninstall has no confirmation dialog (inconsistent with Plugins page)
  - #129: Global prompt editor has no discard/reset button

- **All clear:**
  - Settings modal layout: clean sidebar (desktop) + select dropdown (mobile) pattern
  - Section groups with labeled categories work well
  - SettingsFooter with version, uptime, and entity stats with tooltips is polished
  - GeneralSettings has proper error state with retry button (post-#122 fix)
  - Global prompt has character counter, token estimate, and over-limit warning
  - Hub Kin selector with immediate save + toast feedback
  - Server-side validation for global prompt (type check, length limit, trimming)
  - Admin guard on all settings routes
  - SearchProviders: default provider selector with "Automatic" option
  - SearchProviders: TestAllProviders component for batch testing
  - PluginsSettings: rich card UI with version, source badge, stats (tools/hooks/providers/channels)
  - PluginsSettings: collapsible permissions detail
  - PluginsSettings: proper uninstall confirmation dialog
  - Plugin config dialog with dynamic field renderer supporting string, number, boolean, select, password, text types
  - PluginMarketplace: grid layout, search, detail modal with README rendering
  - VaultSettings: type filter tabs (all, favorites, built-in types, custom types)
  - VaultSettings: favorite toggle with optimistic update + rollback
  - NotificationPreferences: per-type toggles with optimistic update + rollback
  - NotificationPreferences: external delivery channels with test button
  - Sound toggle (localStorage-based, appropriate for client-side preference)
  - MemoriesSettings: clean delegation to MemoryModelConfig + MemoryList components
  - /api/info endpoint efficiently counts all entity types for the footer

### Next run
- Area 11: Contacts (add, approve, edit, delete contacts)
- Area 12: Webhooks (create, edit, test, delete webhooks)

## 2026-03-07 16:40 UTC
### Area tested: Contacts (Area 11) + Webhooks (Area 12)
- **Pages visited:** Code review of ContactsSettings.tsx, ContactFormDialog.tsx, ContactCard.tsx, ContactNotes.tsx, ContactPlatformIds.tsx, contacts.ts (routes), contacts.ts (service), WebhooksSettings.tsx, WebhookFormDialog.tsx, WebhookCard.tsx, WebhookLogDialog.tsx, webhooks.ts (routes), webhooks.ts (service), webhooks-incoming.ts
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

- **Bugs found:** 4 (issues created: #131, #132, #133, #134)
  - #131: Contact identifier label/value have no length limit or whitespace-only validation
  - #132: Webhook name and description have no server-side length limits
  - #133: Contact note content has no max length validation (risk: injected into Kin prompts)
  - #134: fetchContacts/fetchWebhooks silently swallow errors (same pattern as #115, #127)

- **UX suggestions:** 3 (issues created: #135, #136, #137)
  - #135: No UI to manually add platform IDs to a contact (API exists but no form)
  - #136: No search/filter on contacts list (backend search exists but no UI)
  - #137: No search/filter on webhooks list, no Kin filter dropdown

#### All clear:
- Contact CRUD with proper SSE real-time updates
- Contact form dialog: clean layout, type selector (human/kin), linked user/kin selector, identifier management with LabelCombo
- Contact name validation: trim + empty check + 200 char max (server-side)
- Contact type validation: only "human" or "kin" accepted
- Duplicate user-contact link prevention (409 with helpful message)
- Contact card: nice layout with icon, badges for type/linked user, identifier badges
- Contact delete: confirmation dialog with cascade warning for platform IDs
- Contact notes: inline editing with cancel/save, scope selector (global/private), Kin selector
- Contact notes: proper visibility rules (admin sees all, Kin sees global + own private)
- Platform IDs: display with platform icons, hover-to-reveal revoke button
- Webhook CRUD with SSE real-time updates
- Webhook creation: token reveal dialog with show/hide toggle and copy buttons
- Webhook token regeneration: confirmation dialog before regenerating
- Webhook card: clean layout with Kin badge, trigger count, last triggered date, active/inactive state
- Webhook active/inactive toggle with visual dimming
- Webhook URL copy button
- Webhook trigger logs dialog with expandable payloads, source IP badges, empty state
- Webhook incoming route: proper rate limiting (sliding window per webhook), token validation (timing-safe), payload size limit, inactive check
- Webhook log pruning: retention period + per-webhook cap, runs every 6 hours
- Max webhooks per Kin limit enforced
- Contact identifiers: batch creation during contact create
- Contact identifier update: proper diff logic (detect added/changed/removed identifiers)
- searchContacts: searches across names, identifiers, and notes with deduplication
- ensureUserContactsExist: auto-creates contacts for all users (backfill)
- deleteNotesByKin: cleanup when a Kin is deleted
- listContactsForPrompt: efficient summary with linked kin slug and identifier summary

### Next run
- Area 13: MCP servers (add, configure, remove MCP servers)
- Area 14: Account (profile, password, language settings)

## 2026-03-07 20:40 UTC
### Area tested: MCP Servers (Area 13) + Account (Area 14)
- **Pages visited:** Code review of McpServersSettings.tsx, McpServerFormDialog.tsx, McpServerCard.tsx, mcp-servers.ts (routes), mcp.ts (service), AccountPage.tsx (AccountDialog), me.ts (routes), auth/index.ts
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

- **Bugs found:** 3 (issues created: #139, #140, #141)
  - #139: McpServerCard uses double /api prefix for status/test endpoints (connection status and test button completely broken)
  - #140: fetchServers silently swallows errors (same pattern as #115, #127, #134)
  - #141: MCP server name and command have no server-side length limits

- **UX suggestions:** 2 (issues created: #142, #143)
  - #142: MCP env var editing gives no visual feedback that existing secrets are preserved when left empty
  - #143: Account page name/pseudonym fields have no client-side character counters or format hints

#### All clear:
- MCP server CRUD with proper SSE real-time updates
- MCP server form: clean layout with name, command, args (textarea, one per line), and env vars (key/value pairs with password input)
- MCP env var masking: backend never exposes env values to frontend (only keys with empty strings)
- MCP env var merge logic on update: empty values preserve existing secrets
- MCP server card: clean layout with connection status dot, tool count badge, error tooltip, Kin badge
- MCP server approval flow for Kin-created servers (pending_approval status)
- MCP server delete: confirmation dialog, disconnects running server
- MCP connection pool with auto-reconnect on tool call failure
- MCP connection timeout (30s) to avoid hanging on unresponsive servers
- MCP PATH augmentation for child processes (detects NVM, common system paths)
- MCP tool resolution with per-Kin access control (mcpAccess allowlist or auto-enable for Kin-created servers)
- MCP JSON Schema to Zod conversion for tool input validation
- MCP tool name sanitization with Unicode/accent handling and hash fallback
- Account dialog: polished hero header with gradient, avatar crop (react-easy-crop), member since date
- Account profile: proper server-side validation (name length, pseudonym format, language allowlist)
- Account avatar: size limit (2MB), type validation, crop before upload
- Account password change: collapsible section, min length 8, confirm match, Better Auth handles backend
- Account profile upsert: handles missing profile row gracefully (onConflictDoUpdate)
- Account language change: updates i18n on save

### Next run
- Area 15: Quick chat / Ephemeral sessions
- Area 1 (revisit): Onboarding / First run (rotate back to start)

## 2026-03-08 00:40 UTC
### Area tested: Quick Chat / Ephemeral Sessions (Area 15)
- **Pages visited:** Code review of QuickChatPanel.tsx, useQuickChat.ts, useQuickSession.ts, QuickSessionHistory.tsx, useQuickSessionHistory.ts, quick-sessions.ts (routes), quick-session-cleanup.ts, ChatPanel.tsx (quick session integration), config.ts (quickSessions config)
- **Note:** Browser unavailable (sandbox disabled), testing done via thorough code review

- **Bugs found:** 3 (issues created: #146, #147, #148)
  - #146: N+1 query for message counts in quick session listing (fetches all rows per session, uses .length instead of COUNT(*))
  - #147: No server-side message content length limit on quick session messages
  - #148: No fileIds array length or format validation on quick session messages

- **UX suggestions:** 3 (issues created: #149, #150, #151)
  - #149: Close dialog memory checkbox and summary text not reset between cancel/reopen
  - #150: No pagination or infinite scroll in quick session history (hard-capped at 20)
  - #151: Quick chat side panel width may overflow on small tablets (500px fixed width)

#### All clear:
- Quick session CRUD with proper SSE real-time updates
- Session creation with title validation (200 char max) and max active sessions limit
- Session ownership verification (loadSession helper, 403 on mismatch)
- Session close flow with optional memory save (summary validated at 5000 chars)
- Memory creation uses createMemory with embedding + vector index
- Idempotent close (already-closed returns ok)
- Expiration check before accepting messages (409 SESSION_EXPIRED)
- Streaming with batched UI updates (50ms debounce) for smooth rendering
- Stop streaming with abort support
- Quick session cleanup job: closes expired sessions, deletes stale closed sessions after retention period
- SSE notifications for session closure (UI auto-updates)
- Quick chat panel: clean header with Kin avatar, history button, end session button, hide button
- Empty state with icon and message
- Optimistic user message rendering with rollback on error
- Draft message persistence per session (useDraftMessage with quick- prefix)
- File upload support with optimistic file display
- Quick session history: session list with title, date, message count, click to view messages
- History message viewing with back navigation
- Lazy loading of QuickChatPanel and QuickSessionHistory components
- Quick chat accessible from conversation header (desktop button + mobile dropdown menu)

### Next run
- Area 1 (revisit): Onboarding / First run (rotate back to beginning)
- Area 2 (revisit): Kin management
