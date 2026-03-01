# Frontend Perf Journal

## 2026-03-01 18:28 UTC
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

### Next run priorities
1. **React.lazy for routes** - ChatPage, DesignSystemPage, LoginPage, OnboardingPage, InvitePage should be lazy-loaded
2. **React.lazy for heavy components** - MarkdownContent (pulls in markdown+katex), markdown-editor (pulls in CodeMirror)
3. **React.memo audit** - Only 7 components memoized, MessageBubble and MessageInput are prime candidates
4. **DesignSystemPage in production** - 2,713 line component loaded even in prod (gated by `isDev` but still bundled)
5. **Browser audit** - Need to actually check the live UI for visual bugs when browser becomes available
