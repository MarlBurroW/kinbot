/**
 * Tool result renderer registry.
 * Re-exports from tool-registry (cycle-safe) and registers built-in renderers.
 */
export type {
  ToolResultRendererProps,
  ToolPreviewRendererProps,
  ToolPreviewFn,
} from '@/client/lib/tool-registry'

export {
  registerRenderer,
  getRenderer,
  registerPreviewRenderer,
  getPreviewRenderer,
} from '@/client/lib/tool-registry'

import { registerRenderer } from '@/client/lib/tool-registry'

// Register built-in renderers
import { ShellResultRenderer } from '@/client/components/chat/renderers/ShellResultRenderer'
import { HttpRequestRenderer } from '@/client/components/chat/renderers/HttpRequestRenderer'
import { FileReadRenderer } from '@/client/components/chat/renderers/FileReadRenderer'
import { FileWriteRenderer } from '@/client/components/chat/renderers/FileWriteRenderer'
import { FileEditRenderer } from '@/client/components/chat/renderers/FileEditRenderer'
import { ListDirectoryRenderer } from '@/client/components/chat/renderers/ListDirectoryRenderer'
import { BrowserScreenshotRenderer } from '@/client/components/chat/renderers/BrowserScreenshotRenderer'
import { BrowserPageStateRenderer } from '@/client/components/chat/renderers/BrowserPageStateRenderer'

registerRenderer('run_shell', ShellResultRenderer)
registerRenderer('http_request', HttpRequestRenderer)
registerRenderer('read_file', FileReadRenderer)
registerRenderer('write_file', FileWriteRenderer)
registerRenderer('edit_file', FileEditRenderer)
registerRenderer('list_directory', ListDirectoryRenderer)

// Browser tools — screenshot-shaped results (image thumbnail with click-to-zoom)
registerRenderer('screenshot_url', BrowserScreenshotRenderer)
registerRenderer('browser_screenshot', BrowserScreenshotRenderer)
registerRenderer('browser_request_human', BrowserScreenshotRenderer)

// Browser tools — page-state-shaped results (URL + title + refs + snapshot)
registerRenderer('browser_open_session', BrowserPageStateRenderer)
registerRenderer('browser_close_session', BrowserPageStateRenderer)
registerRenderer('browser_navigate', BrowserPageStateRenderer)
registerRenderer('browser_click', BrowserPageStateRenderer)
registerRenderer('browser_type', BrowserPageStateRenderer)
registerRenderer('browser_select', BrowserPageStateRenderer)
registerRenderer('browser_press_key', BrowserPageStateRenderer)
registerRenderer('browser_scroll', BrowserPageStateRenderer)
registerRenderer('browser_wait_for', BrowserPageStateRenderer)

// Register built-in preview renderers (collapsed inline view)
import '@/client/lib/tool-preview-renderers'
