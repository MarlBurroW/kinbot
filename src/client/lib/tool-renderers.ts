/**
 * Tool result renderer registry.
 * Maps tool names to custom React components for rich display.
 * Also provides a preview renderer registry for inline (collapsed) previews.
 */
import type { ComponentType } from 'react'

export interface ToolResultRendererProps {
  toolName: string
  args: Record<string, unknown>
  result: unknown
  status: 'success' | 'error' | 'pending'
}

export interface ToolPreviewRendererProps {
  toolName: string
  args: Record<string, unknown>
  status: 'success' | 'error' | 'pending'
}

/** Returns a short string (or null to fall back to default) */
export type ToolPreviewFn = (props: ToolPreviewRendererProps) => string | null

// --- Result renderer registry (expanded view) ---

const registry = new Map<string, ComponentType<ToolResultRendererProps>>()

export function registerRenderer(toolName: string, component: ComponentType<ToolResultRendererProps>) {
  registry.set(toolName, component)
}

export function getRenderer(toolName: string): ComponentType<ToolResultRendererProps> | undefined {
  return registry.get(toolName)
}

// --- Preview renderer registry (collapsed inline view) ---

const previewRegistry = new Map<string, ToolPreviewFn>()

export function registerPreviewRenderer(toolName: string, fn: ToolPreviewFn) {
  previewRegistry.set(toolName, fn)
}

export function getPreviewRenderer(toolName: string): ToolPreviewFn | undefined {
  return previewRegistry.get(toolName)
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

// Register built-in preview renderers (collapsed inline view)
import '@/client/lib/tool-preview-renderers'
