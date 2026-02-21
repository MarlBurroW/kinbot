import { useRef, useState, useCallback, useEffect } from 'react'
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { cn } from '@/client/lib/utils'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  height?: string
  readOnly?: boolean
  className?: string
}

/** Read a CSS variable from :root and convert to hex via Canvas 2D (handles oklch, hsl, rgb, etc.) */
function cssVarToHex(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!raw) return fallback
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    if (!ctx) return fallback
    ctx.fillStyle = raw
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return `#${d[0].toString(16).padStart(2, '0')}${d[1].toString(16).padStart(2, '0')}${d[2].toString(16).padStart(2, '0')}`
  } catch {
    return fallback
  }
}

function buildThemeColors() {
  const bg = cssVarToHex('--color-background', '#fafafa')
  const fg = cssVarToHex('--color-foreground', '#1a1a2e')
  const primary = cssVarToHex('--color-primary', '#7c3aed')
  const muted = cssVarToHex('--color-muted', '#f0f0f5')
  const mutedFg = cssVarToHex('--color-muted-foreground', '#6b6b80')
  const border = cssVarToHex('--color-border', '#e5e5ea')
  const accent = cssVarToHex('--color-accent', '#ede0f0')
  const info = cssVarToHex('--color-info', '#3b82f6')
  const success = cssVarToHex('--color-success', '#22c55e')
  const warning = cssVarToHex('--color-warning', '#eab308')
  const destructive = cssVarToHex('--color-destructive', '#ef4444')
  return { bg, fg, primary, muted, mutedFg, border, accent, info, success, warning, destructive }
}

const THEME_NAME = 'kinbot'

function defineKinbotTheme(monaco: Parameters<BeforeMount>[0], isDark: boolean) {
  const c = buildThemeColors()
  monaco.editor.defineTheme(THEME_NAME, {
    base: isDark ? 'vs-dark' : 'vs',
    inherit: true,
    rules: [
      // Markdown headings
      { token: 'keyword.md', foreground: c.primary.slice(1), fontStyle: 'bold' },
      // Bold
      { token: 'strong.md', foreground: c.fg.slice(1), fontStyle: 'bold' },
      // Italic
      { token: 'emphasis.md', foreground: c.fg.slice(1), fontStyle: 'italic' },
      // Links
      { token: 'string.link.md', foreground: c.info.slice(1) },
      // Inline code
      { token: 'variable.md', foreground: c.success.slice(1) },
      // List markers
      { token: 'punctuation.md', foreground: c.primary.slice(1) },
      // Blockquotes
      { token: 'comment.md', foreground: c.mutedFg.slice(1), fontStyle: 'italic' },
      // HR
      { token: 'meta.separator.md', foreground: c.border.slice(1) },
    ],
    colors: {
      'editor.background': c.bg,
      'editor.foreground': c.fg,
      'editor.lineHighlightBackground': c.muted + '40',
      'editor.selectionBackground': c.primary + '30',
      'editor.inactiveSelectionBackground': c.primary + '18',
      'editorLineNumber.foreground': c.mutedFg + '80',
      'editorLineNumber.activeForeground': c.primary,
      'editorCursor.foreground': c.primary,
      'editorIndentGuide.background': c.border + '40',
      'editorIndentGuide.activeBackground': c.border,
      'editor.selectionHighlightBackground': c.accent + '40',
      'editorWidget.background': c.bg,
      'editorWidget.border': c.border,
      'scrollbarSlider.background': c.mutedFg + '20',
      'scrollbarSlider.hoverBackground': c.mutedFg + '40',
      'scrollbarSlider.activeBackground': c.mutedFg + '60',
    },
  })
}

export function MarkdownEditor({
  value,
  onChange,
  height = '200px',
  readOnly = false,
  className,
}: MarkdownEditorProps) {
  const { resolvedTheme } = useTheme()
  const [isFocused, setIsFocused] = useState(false)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)
  const monacoRef = useRef<Parameters<BeforeMount>[0] | null>(null)

  // Use a ref so callbacks always read the latest value
  const isDark = resolvedTheme === 'dark'
  const isDarkRef = useRef(isDark)
  isDarkRef.current = isDark

  const handleBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco
    // Use ref to get the current value, not the stale closure
    defineKinbotTheme(monaco, isDarkRef.current)
  }

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.onDidFocusEditorWidget(() => setIsFocused(true))
    editor.onDidBlurEditorWidget(() => setIsFocused(false))

    // Force theme update now that Monaco is fully loaded
    // (resolvedTheme may have changed since beforeMount)
    if (monacoRef.current) {
      defineKinbotTheme(monacoRef.current, isDarkRef.current)
      monacoRef.current.editor.setTheme(THEME_NAME)
    }
  }

  // Re-define theme when palette or dark/light mode changes
  const updateTheme = useCallback(() => {
    if (!monacoRef.current) return
    defineKinbotTheme(monacoRef.current, isDarkRef.current)
    monacoRef.current.editor.setTheme(THEME_NAME)
  }, [])

  useEffect(() => {
    updateTheme()
  }, [resolvedTheme, updateTheme])

  // Also observe palette changes (data-palette attribute on <html>)
  useEffect(() => {
    const observer = new MutationObserver(() => {
      // Small delay to let CSS variables update
      requestAnimationFrame(() => updateTheme())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-palette'],
    })
    return () => observer.disconnect()
  }, [updateTheme])

  return (
    <div className={cn(
      'overflow-hidden rounded-md border border-input transition-[color,box-shadow]',
      isFocused && 'border-ring ring-[3px] ring-ring/50',
      className
    )}>
      <Editor
        height={height}
        language="markdown"
        theme={THEME_NAME}
        value={value}
        onChange={(v) => onChange(v ?? '')}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          lineNumbers: 'on',
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          folding: true,
          foldingHighlight: false,
          glyphMargin: false,
          lineDecorationsWidth: 4,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'line',
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          scrollbar: {
            vertical: 'auto',
            horizontal: 'hidden',
            verticalScrollbarSize: 8,
          },
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
          fontSize: 13,
          lineHeight: 20,
          padding: { top: 12, bottom: 12 },
          readOnly,
          domReadOnly: readOnly,
          contextmenu: false,
          quickSuggestions: false,
          suggestOnTriggerCharacters: false,
          parameterHints: { enabled: false },
          tabCompletion: 'off',
          bracketPairColorization: { enabled: false },
          guides: { indentation: false },
          renderWhitespace: 'none',
        }}
      />
    </div>
  )
}
