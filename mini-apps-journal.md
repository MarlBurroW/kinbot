# Mini-Apps SDK Journal

## 2026-03-01 (run 3) — SDK API Expansion: kin, user, resize, notification

**What:** Added 4 new SDK APIs to `kinbot-sdk.js` (v1.12.0) and the corresponding parent-side handlers in `MiniAppViewer.tsx`.

**New APIs:**
- **`KinBot.kin`** — getter returning `{id, name, avatarUrl}` about the parent Kin. Derived from app-meta (added `kinAvatarUrl` to the payload).
- **`KinBot.user`** — getter returning `{id, name, pseudonym, locale, timezone, avatarUrl}` about the current user. Viewer now sends user profile from `useAuth()` in app-meta.
- **`KinBot.resize(width?, height?)`** — request panel resize. Width clamped 320-1200px, height clamped 200-2000px. Works in side-panel mode.
- **`KinBot.notification(title, body?)`** — request a browser notification via the parent window (which has Notification permission). Returns `Promise<boolean>`. Handles permission request flow.

**Files changed:**
- `src/server/mini-app-sdk/kinbot-sdk.js` — added internal state, app-meta extraction, resize/notification functions, public API entries
- `src/client/components/mini-app/MiniAppViewer.tsx` — imports `useAuth`, sends user/kinAvatarUrl in app-meta, handles resize/notification messages
- `src/server/tools/mini-app-tools.ts` — documented new APIs in tool descriptions

**Next priorities:**
1. Add Grid component for responsive layouts
2. Add Breadcrumbs, Popover components
3. `KinBot.memory.search()` / `KinBot.memory.store()` — requires new API routes
4. `KinBot.conversation.history()` / `KinBot.conversation.send()` — requires new API routes
5. `KinBot.shortcut(key, callback)` — keyboard shortcut registration
6. `KinBot.share(data)` — inter-app data sharing

## 2026-03-01 — React Component Library (@kinbot/components)

**What:** Created `kinbot-components.js` — a full React component library served as ES module.

**Components shipped (25):**
- **Layout:** Stack, Divider
- **Data display:** Badge, Tag, Stat, Avatar, Tooltip, ProgressBar
- **Forms:** Input, Select, Textarea, Checkbox, Switch, Button, ButtonGroup
- **Feedback:** Alert, Spinner, Skeleton, EmptyState
- **Navigation:** Tabs, Pagination
- **Data:** Table, List
- **Overlays:** Modal, Drawer
- **Containers:** Card (+ Header, Title, Description, Content, Footer sub-components)

**Files changed:**
- `src/server/mini-app-sdk/kinbot-components.js` — NEW (780+ lines)
- `src/server/routes/mini-apps.ts` — added route for `/kinbot-components.js`
- `src/server/mini-app-sdk/kinbot-sdk.css` — added slide-in-left/right animations
- `src/server/tools/mini-app-templates.ts` — added `@kinbot/components` to default importmap
- `src/server/tools/mini-app-tools.ts` — documented all components in tool descriptions

**Design decisions:**
- Used `React.createElement` throughout (no JSX) since it's served as plain JS
- All components use CSS variables from kinbot-sdk.css for theme integration
- Components use existing CSS classes (.btn, .card, .input, etc.) where available
- Modal/Drawer render inside the iframe (for parent-level dialogs, use KinBot.confirm/prompt)
- Card has compound component pattern (Card.Header, Card.Title, etc.)
- All interactive elements have ARIA attributes and keyboard support

**Pre-existing test failures (not introduced by this change):**
- `files.test.ts` — SyntaxError: Export 'files' not found in schema.ts
- `matrix.test.ts` — SyntaxError: Export 'like' not found in drizzle-orm

**Next priorities:**
1. ~~Update templates to demonstrate components~~ ✅ Done (2026-03-01, run 2)
2. Add Grid component for responsive layouts
3. Consider a `Form` compound component with validation
4. Add Breadcrumbs component
5. Add Popover component
6. SDK API expansion (KinBot.kin, KinBot.user, KinBot.memory, etc.)

## 2026-03-01 (run 2) — Templates rewritten to use @kinbot/components

**What:** Rewrote 3 templates (dashboard, data-viewer, form) to use the component library instead of raw HTML/CSS.

**Changes:**
- **Dashboard:** Now uses `Card`, `Stat`, `Badge`, `Table`, `ProgressBar`, `Tabs`, `List`, `Stack`, `Spinner`. Added tabbed view (Overview + Projects) to showcase `Tabs`. Much less custom CSS.
- **Data Viewer:** Now uses `Card`, `Table`, `Badge`, `Pagination`, `Input`, `Button`, `EmptyState`, `Stack`, `Spinner`. Removed all custom CSS except `body { padding }`.
- **Form:** Now uses `Card` (with Header/Title/Description/Content), `Input`, `Select`, `Textarea`, `Checkbox`, `Button`, `Alert`, `Divider`, `Stack`, `Spinner`. Added success alert on submit.
- **Kanban & Todo:** Left unchanged (already good examples of storage + drag-drop patterns, less component-heavy by nature)

**Impact:** Templates now serve as living documentation for the component library. Kins seeing these templates learn how to import and use components properly.

**Next priorities:**
1. Add Grid component for responsive layouts
2. SDK API expansion (KinBot.kin, KinBot.user, KinBot.memory, etc.)
3. Add Breadcrumbs, Popover components
4. Update tool descriptions with component usage examples
