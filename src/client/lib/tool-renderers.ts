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

registerRenderer('run_shell', ShellResultRenderer)
registerRenderer('http_request', HttpRequestRenderer)
registerRenderer('read_file', FileReadRenderer)
registerRenderer('write_file', FileWriteRenderer)
registerRenderer('edit_file', FileEditRenderer)
registerRenderer('list_directory', ListDirectoryRenderer)

// Register built-in preview renderers (collapsed inline view)
import '@/client/lib/tool-preview-renderers'
