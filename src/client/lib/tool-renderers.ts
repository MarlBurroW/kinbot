/**
 * Tool result renderer registry.
 * Maps tool names to custom React components for rich display.
 */
import type { ComponentType } from 'react'

export interface ToolResultRendererProps {
  toolName: string
  args: Record<string, unknown>
  result: unknown
  status: 'success' | 'error' | 'pending'
}

const registry = new Map<string, ComponentType<ToolResultRendererProps>>()

export function registerRenderer(toolName: string, component: ComponentType<ToolResultRendererProps>) {
  registry.set(toolName, component)
}

export function getRenderer(toolName: string): ComponentType<ToolResultRendererProps> | undefined {
  return registry.get(toolName)
}

// Register built-in renderers (lazy imports to avoid bloating main bundle)
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
