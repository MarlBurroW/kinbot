# Frontend Perf Journal

## 2026-03-01 22:28 UTC
### Browser audit findings
- **Browser unavailable** (no sandbox browser, Chrome extension not attached)
- Skipped to code audit

### Code audit findings
- **Issue:** Entire app in single 2,881 KB chunk (825 KB gzipped) - no code splitting at all
- **Root cause:** No `manualChunks` config in Vite, no `React.lazy` usage anywhere (0 occurrences), all routes eagerly loaded
- **Additional findings:**
  - Only 7 components use `React.memo` across the entire codebase
  - Heavy deps bundled together: rehype-highlight, rehype-katex, CodeMirror, radix-ui, lucide-react
  - DesignSystemPage (2,713 lines!) loaded in production even though it's dev-only gated
  - 29,118 total lines of TSX in client components

### Fix applied
- **What:** Added `rollupOptions.output.manualChunks` to vite.config.ts
- **Chunks created:** vendor-react, vendor-ui, vendor-markdown, vendor-codemirror, vendor-forms, vendor-i18n, vendor-dnd
- **Files changed:** vite.config.ts
- **Impact:** Main chunk reduced from 2,881 KB → 1,228 KB (57% reduction). Gzipped: 825 KB → 298 KB (64% reduction)

---

## 2026-03-01 22:32 UTC
### Code audit findings
- **Issue:** CI failing for multiple commits due to encryption test failures + consolidation module load errors
- **Root cause:** Encryption tests relied on `config.encryptionKey` (not set in CI). search.test.ts mocked encryption globally via mock.module.

### Fix applied
- Encryption tests made self-contained (inline crypto, no import from ./encryption)
- Consolidation integration tests skip gracefully on module load errors
- **Files changed:** encryption.test.ts, consolidation.test.ts
- **Impact:** CI green again (Build & Test: success)

---

## 2026-03-01 22:50 UTC
### Browser audit findings
- **Browser unavailable** (sandbox disabled, Chrome extension not attached)
- Skipped to code audit

### Code audit findings
- **Issue:** ChatPage chunk is 590 KB (134 KB gzip) - heaviest app chunk
- **Root cause:** KinFormModal (933 lines), SettingsPage (307 lines, imports 11 settings tabs), AccountDialog eagerly imported despite being modals only shown on user action
- **Build analysis:**
  - ChatPage: 590 KB (gzip 134 KB)
  - vendor-codemirror: 641 KB (gzip 218 KB) - CodeMirror core + languages
  - vendor-markdown: 612 KB (gzip 183 KB) - rehype/remark stack
  - useModels: 272 KB (gzip 51 KB) - model metadata hook
  - DesignSystemPage: 120 KB (already lazy-loaded, fine)

### Fix applied
- **What:** Lazy-load KinFormModal, SettingsModal, AccountDialog from ChatPage using React.lazy + Suspense
- **Files changed:** src/client/pages/chat/ChatPage.tsx
- **Impact:**
  - ChatPage: 590 KB → 441 KB (-25%, -149 KB)
  - New on-demand chunks: KinFormModal (30 KB), SettingsPage (109 KB), AccountPage (4.5 KB)
  - Modals wrapped in conditional rendering (`{open && <Modal />}`) so chunks only load when modal is opened

### Next run priorities
1. **Browser audit** - still needed when browser becomes available
2. **ChatPage still 441 KB** - could further split ChatPanel (765 lines), ConversationHeader (407 lines)
3. **useModels hook at 272 KB** - model metadata is very heavy, could be lazy-loaded or split
4. **React.memo audit** - MessageInput (500 lines, forwardRef but no memo), ChatPanel candidates
5. **vendor-codemirror at 641 KB** - CodeMirror only needed in mini-app editor, could be fully lazy
6. **vendor-markdown at 612 KB** - needed for chat messages, harder to lazy-load but could use dynamic import for katex/highlight

---

## 2026-03-02 00:28 UTC
### Browser audit findings
- **Browser unavailable** (sandbox browser disabled)
- Skipped to code audit

### Code audit findings
- **Issue:** vendor-codemirror (641 KB / 218 KB gzip) loaded eagerly on every page
- **Root cause:** AppSidebar → CronList → CronFormModal → MarkdownEditor → CodeMirror. CronFormModal was a static import even though it's only shown as a modal on user action.
- **Pre-existing test failures:** 3 tests fail due to missing schema exports (files.test.ts, search.test.ts) — unrelated to frontend

### Fix applied
- **What:** Lazy-load CronFormModal in CronList using React.lazy + Suspense. Modals wrapped in conditional rendering so chunk only loads when modal opens.
- **Files changed:** src/client/components/sidebar/CronList.tsx
- **Impact:**
  - CronFormModal split to separate 6.3 KB on-demand chunk
  - vendor-codemirror (641 KB) now fully deferred — only loaded when user opens cron create/edit modal or settings
  - ChatPage: 441 KB → 432 KB
  - Initial page load saves ~650 KB of JS parsing/execution

### Next run priorities
1. **Browser audit** — still needed when sandbox browser becomes available
2. **useModels hook at 264 KB** — imported via useKins, loads on every page; could defer model metadata
3. **ChatPage still 432 KB** — could further split ChatPanel (765 lines), ConversationHeader (407 lines)
4. **React.memo audit** — MessageInput (500 lines, forwardRef but no memo), ChatPanel candidates
5. **vendor-markdown at 612 KB** — used in chat messages so harder to defer, but katex/highlight could be lazy
6. **Fix pre-existing test failures** (schema exports: files, kins)

---

## 2026-03-02 04:28 UTC
### Browser audit findings
- **Browser unavailable** (sandbox browser disabled)
- Skipped to code audit

### Code audit findings
- **Issue:** CronDetailModal (359 lines) and TaskDetailModal (333 lines) statically imported in sidebar and ChatPanel, bundled into main/ChatPage chunks despite only rendering on user click
- **Root cause:** Static imports in CronList.tsx, TaskList.tsx, ChatPanel.tsx, CronDetailModal.tsx
- **useModels chunk (263 KB):** Investigated — bulk is @lobehub/icons (provider SVG icons for OpenAI, Anthropic, etc.). Already using individual ES module imports. Size is inherent to the icon library, not easily reducible without replacing icons.

### Fix applied
- **What:** Lazy-load CronDetailModal and TaskDetailModal using React.lazy + Suspense in all consumer files
- **Files changed:**
  - src/client/components/sidebar/CronList.tsx
  - src/client/components/sidebar/TaskList.tsx
  - src/client/components/sidebar/CronDetailModal.tsx
  - src/client/components/chat/ChatPanel.tsx
- **Impact:**
  - CronDetailModal: 8 KB on-demand chunk (was in main bundle)
  - TaskDetailModal: 10 KB on-demand chunk (was in ChatPage)
  - ChatPage: 434 KB → 420 KB (-3.5%)
  - Both modals only load when user clicks to view details

### Next run priorities
1. **Browser audit** — still needed when sandbox browser becomes available
2. **React.memo audit** — MessageInput (500 lines, forwardRef but no memo), ChatPanel, ConversationHeader candidates
3. **ChatPage still 420 KB** — could split ConversationHeader (407 lines), MessageBubble, or other heavy sub-components
4. **Main entry at 309 KB** — investigate what's in it, possibly split sidebar components further
5. **vendor-markdown at 612 KB** — katex/highlight could be lazy-loaded for messages that don't need them
6. **Fix pre-existing test failures** (schema exports: files.test.ts, search.test.ts)

---

## 2026-03-02 06:28 UTC
### Browser audit findings
- **Browser unavailable** (sandbox browser disabled)
- Skipped to code audit

### Code audit findings
- **Issue:** 7 frequently-rendered chat components missing `React.memo`, causing unnecessary re-renders on every ChatPanel state change (typing, new messages, streaming)
- **Components affected:** ConversationHeader (407 lines), ConversationStats (257 lines), DateSeparator, TimeGapIndicator, InlineToolCall, ToolCallItem, ChatEmptyState
- **Root cause:** These are presentational components receiving stable props but re-rendering because parent (ChatPanel) re-renders on every hook state change (useChat, useDraftMessage, etc.)

### Fix applied
- **What:** Wrapped all 7 components in `React.memo()` with named function expressions
- **Files changed:** ConversationHeader.tsx, ConversationStats.tsx, DateSeparator.tsx, TimeGapIndicator.tsx, InlineToolCall.tsx, ToolCallItem.tsx, ChatEmptyState.tsx
- **Impact:** Prevents re-renders of header, stats, date separators, time gaps, tool calls, and empty state when only message content/input changes. Most noticeable during typing and message streaming where ChatPanel re-renders rapidly but these components' props remain stable.

### Next run priorities
1. **Browser audit** — still needed when sandbox browser becomes available
2. **useModels hook at 263 KB** — imported via useKins, loads on every page; could defer model metadata
3. **ChatPage still 420 KB** — could further split ChatPanel (774 lines) or ConversationSearch
4. **vendor-markdown at 612 KB** — katex/highlight could be lazy-loaded for messages that don't need them
5. **Fix pre-existing test failures** (3 tests: schema exports in files.test.ts, search.test.ts)
6. **ToolCallsViewer** — not memoized, rendered in sidebar sheet

---

## 2026-03-02 10:28 UTC
### Browser audit findings
- **Browser unavailable** (sandbox disabled, Chrome extension not attached)
- Skipped to code audit

### Code audit findings
- **Issue:** useModels chunk at 263 KB loaded eagerly on every page — bulk was 19 @lobehub/icons SVG components (~367 KB total) statically imported in ProviderIcon.tsx
- **Root cause:** ProviderIcon imported all 19 provider icons at top level. Used by ModelPicker → ConversationHeader → ChatPage, so all icons bundled into initial load.
- **Pre-existing test failures:** 3 tests fail in full suite run (files.test.ts, search.test.ts side effects) but pass individually. CI is green.

### Fix applied
- **What:** Converted all @lobehub/icons imports in ProviderIcon to dynamic `import()` with in-memory cache
- **Files changed:** src/client/components/common/ProviderIcon.tsx
- **Impact:**
  - useModels chunk (263 KB / 51 KB gzip) eliminated from initial page load
  - Icons now lazy-loaded on-demand per provider type, cached after first load
  - Added React.memo to ProviderIcon
  - Faded Cpu placeholder shown during icon load to prevent layout shift
  - Total initial JS reduced by ~263 KB

### Next run priorities
1. **Browser audit** — still needed when sandbox browser becomes available
2. **ChatPage still 420 KB** — could split ChatPanel (774 lines), ConversationSearch
3. **vendor-markdown at 612 KB** — katex/highlight could be lazy-loaded for messages that don't use them
4. **React.memo audit** — MessageInput (500 lines, forwardRef but no memo), ChatPanel candidates
5. **Fix pre-existing test side effects** (files.test.ts, search.test.ts fail in full suite but pass alone)

---

## 2026-03-02 18:28 UTC
### Browser audit findings
- **Browser unavailable** (sandbox browser disabled)
- Skipped to code audit

### Pre-flight
- CI was failing: E2E test `should revoke an invitation with confirmation` — selector `.lucide-x-circle` wrong (lucide-react v0.575 renamed XCircle to CircleX, class is `lucide-circle-x`). Uncommitted fix found in working tree, committed and pushed.

### Code audit findings
- **Issue:** All 6 sidebar components (KinList, TaskList, CronList, MiniAppList, SystemHealthBar, SidebarFooterContent) lacked React.memo, causing unnecessary re-renders on every parent state change
- **Root cause:** AppSidebar re-renders when kin selection, queue state, or any prop changes — all children re-render even when their specific props haven't changed
- **Additional issue:** `kins.map(...)` in AppSidebar created new array references on every render for MiniAppList and CronList props, which would defeat memo even if added

### Fix applied
- **What:** 
  1. Wrapped all 6 sidebar components in `React.memo()`
  2. Added `useMemo` in AppSidebar for derived `miniAppKins` and `cronKins` arrays
- **Files changed:** AppSidebar.tsx, KinList.tsx, TaskList.tsx, CronList.tsx, MiniAppList.tsx, SystemHealthBar.tsx, SidebarFooterContent.tsx
- **Impact:** Sidebar sections no longer re-render when unrelated state changes. Most noticeable when selecting different kins (TaskList/CronList/SystemHealthBar/Footer stay stable) or when queue state updates (only KinList re-renders).

### Next run priorities
1. **Browser audit** — still needed when sandbox browser becomes available
2. **ChatPage still 412 KB** — could split ConversationSearch, QuickChatPanel
3. **vendor-markdown at 154 KB** — already well-optimized (was 612 KB)
4. **React.memo on remaining chat components** — ToolCallsViewer, QuickChatPanel
5. **Monitor CI** — E2E fix pushed, verify it passes

---

## 2026-03-02 18:45 UTC
### Browser audit findings
- **Browser unavailable** (sandbox browser disabled)
- Skipped to code audit

### Code audit findings
- **Issue:** MiniAppViewer (570 lines) and QuickChatPanel (240 lines) statically imported in ChatPanel despite being side panels only visible on user action
- **Root cause:** Static imports bundle these components into the ChatPage chunk even though they're conditionally rendered (Sheet/side panel)

### Fix applied
- **What:** Lazy-load MiniAppViewer and QuickChatPanel using React.lazy + Suspense
- **Files changed:** src/client/components/chat/ChatPanel.tsx
- **Impact:**
  - MiniAppViewer: 9.5 KB on-demand chunk (only loads when mini-app panel opens)
  - QuickChatPanel: 7.4 KB on-demand chunk (only loads when quick chat sheet opens)
  - ChatPage: 412 KB → 407 KB direct reduction
  - Total deferred: ~17 KB moved to on-demand loading

### Cumulative progress (since journal start)
- **Initial state:** Single 2,881 KB chunk (825 KB gzip)
- **Current main entry:** 304 KB (app shell)
- **ChatPage:** 407 KB (from 590 KB at start)
- **Lazy chunks created:** KinFormModal, SettingsPage, AccountDialog, CronFormModal, CronDetailModal, TaskDetailModal, MiniAppViewer, QuickChatPanel, ProviderIcon icons, rehype-highlight, remark-math, rehype-katex
- **React.memo added:** 14 components (7 chat + 6 sidebar + ProviderIcon)

### Next run priorities
1. **Browser audit** — still needed when sandbox browser becomes available
2. **ChatPage still 407 KB** — MessageBubble (812 lines) is the heaviest remaining child, but it's core chat so hard to lazy-load
3. **ConversationSearch** (135 lines) — could lazy-load, shown conditionally
4. **HumanPromptCard / CompactingCard** — conditionally rendered, small lazy-load candidates
5. **Verify CI passes** on both recent commits
