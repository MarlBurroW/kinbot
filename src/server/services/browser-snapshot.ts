import type { Page } from 'playwright'

/**
 * Build a compact, LLM-friendly snapshot of a page's interactable elements.
 *
 * Each interactable element gets a stable `ref` like "e1", "e2"... that the
 * LLM uses with browser_click / browser_type / browser_select. The ref is
 * implemented by tagging elements with a `data-kbref` attribute, so resolving
 * a ref back to an element is a simple `[data-kbref="eN"]` selector — robust
 * across re-renders within the same page state.
 *
 * Refs are recomputed on every snapshot. The LLM should always use refs from
 * the most recent page_state, never refs from previous turns.
 */
export interface PageState {
  url: string
  title: string
  /** Headings (h1-h3) for orientation */
  headings: Array<{ level: 1 | 2 | 3; text: string }>
  /** Interactable elements with refs */
  elements: Array<{
    ref: string
    role: string
    name: string
    type?: string
    value?: string
    placeholder?: string
    checked?: boolean
    disabled?: boolean
  }>
  /** Plain visible text of the page, truncated. Useful for context. */
  contentText: string
  /** YAML-formatted version of the above, ready to feed to an LLM */
  yaml: string
}

const MAX_CONTENT_TEXT = 4000
const MAX_NAME_LEN = 120

/**
 * Tag interactable elements with `data-kbref` attributes and extract
 * a structured snapshot. Runs entirely inside the browser via page.evaluate().
 */
export async function getPageState(page: Page): Promise<PageState> {
  const raw = await page.evaluate(({ MAX_CONTENT_TEXT, MAX_NAME_LEN }) => {
    // Clear stale refs from previous snapshots
    document.querySelectorAll('[data-kbref]').forEach((el) => el.removeAttribute('data-kbref'))

    const isVisible = (el: Element): boolean => {
      const rect = (el as HTMLElement).getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) return false
      const style = window.getComputedStyle(el as HTMLElement)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
      return true
    }

    const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

    const elementName = (el: HTMLElement): string => {
      const candidates = [
        el.getAttribute('aria-label'),
        el.getAttribute('alt'),
        el.getAttribute('title'),
        el.getAttribute('placeholder'),
        // For form elements, the associated label
        ((): string | null => {
          if (el.id) {
            const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
            if (lbl) return lbl.textContent?.trim() ?? null
          }
          const parentLabel = el.closest('label')
          if (parentLabel) {
            // Strip the input's own text from the label text
            return parentLabel.textContent?.trim() ?? null
          }
          return null
        })(),
        // Inner text (last resort)
        el.innerText?.trim() || el.textContent?.trim() || null,
        el.getAttribute('name'),
        el.getAttribute('value'),
      ]
      for (const c of candidates) {
        if (c && c.length > 0) return truncate(c.replace(/\s+/g, ' '), MAX_NAME_LEN)
      }
      return ''
    }

    const inferRole = (el: HTMLElement): string => {
      const explicit = el.getAttribute('role')
      if (explicit) return explicit
      const tag = el.tagName.toLowerCase()
      switch (tag) {
        case 'a': return el.hasAttribute('href') ? 'link' : 'generic'
        case 'button': return 'button'
        case 'input': {
          const type = (el as HTMLInputElement).type
          if (type === 'checkbox') return 'checkbox'
          if (type === 'radio') return 'radio'
          if (type === 'submit' || type === 'button') return 'button'
          if (type === 'file') return 'fileinput'
          return 'textbox'
        }
        case 'textarea': return 'textbox'
        case 'select': return 'combobox'
        case 'option': return 'option'
        case 'summary': return 'button'
        default: return tag
      }
    }

    const interactableSelector = [
      'a[href]',
      'button',
      'input:not([type="hidden"])',
      'textarea',
      'select',
      'summary',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="radio"]',
      '[role="textbox"]',
      '[role="combobox"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="switch"]',
      '[contenteditable=""]',
      '[contenteditable="true"]',
      '[onclick]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(', ')

    const seen = new Set<Element>()
    const elements: Array<Record<string, unknown>> = []
    let counter = 0

    document.querySelectorAll(interactableSelector).forEach((el) => {
      if (seen.has(el)) return
      seen.add(el)
      const html = el as HTMLElement
      if (!isVisible(html)) return
      // Filter out tiny/empty elements without any name
      const name = elementName(html)
      counter++
      const ref = `e${counter}`
      html.setAttribute('data-kbref', ref)

      const role = inferRole(html)
      const item: Record<string, unknown> = { ref, role, name }

      if (html.tagName === 'INPUT') {
        const input = html as HTMLInputElement
        if (input.type) item.type = input.type
        if (input.value) item.value = truncate(input.value, MAX_NAME_LEN)
        if (input.placeholder) item.placeholder = input.placeholder
        if (input.type === 'checkbox' || input.type === 'radio') item.checked = input.checked
        if (input.disabled) item.disabled = true
      } else if (html.tagName === 'TEXTAREA') {
        const ta = html as HTMLTextAreaElement
        if (ta.value) item.value = truncate(ta.value, MAX_NAME_LEN)
        if (ta.placeholder) item.placeholder = ta.placeholder
        if (ta.disabled) item.disabled = true
      } else if (html.tagName === 'SELECT') {
        const sel = html as HTMLSelectElement
        if (sel.value) item.value = sel.value
        if (sel.disabled) item.disabled = true
      } else if (html.tagName === 'BUTTON') {
        const btn = html as HTMLButtonElement
        if (btn.disabled) item.disabled = true
      }

      elements.push(item)
    })

    const headings: Array<{ level: number; text: string }> = []
    document.querySelectorAll('h1, h2, h3').forEach((h) => {
      const text = h.textContent?.trim() ?? ''
      if (text) headings.push({ level: parseInt(h.tagName[1]!, 10), text: truncate(text, 200) })
    })

    const contentText = truncate(
      (document.body?.innerText ?? '').replace(/\n{3,}/g, '\n\n'),
      MAX_CONTENT_TEXT,
    )

    return {
      url: location.href,
      title: document.title,
      headings,
      elements,
      contentText,
    }
  }, { MAX_CONTENT_TEXT, MAX_NAME_LEN })

  return {
    ...raw,
    headings: raw.headings as PageState['headings'],
    elements: raw.elements as PageState['elements'],
    yaml: formatPageStateYaml(raw),
  }
}

function escapeYaml(s: string): string {
  if (/[:#\n"'\\\\\[\]{},&*?|<>=!%@`]/.test(s) || s.startsWith('-') || s.startsWith(' ') || s.endsWith(' ')) {
    return JSON.stringify(s)
  }
  return s
}

function formatPageStateYaml(s: {
  url: string
  title: string
  headings: Array<{ level: number; text: string }>
  elements: Array<Record<string, unknown>>
  contentText: string
}): string {
  const lines: string[] = []
  lines.push(`url: ${escapeYaml(s.url)}`)
  if (s.title) lines.push(`title: ${escapeYaml(s.title)}`)
  if (s.headings.length > 0) {
    lines.push('headings:')
    for (const h of s.headings) {
      lines.push(`  - h${h.level}: ${escapeYaml(h.text)}`)
    }
  }
  if (s.elements.length > 0) {
    lines.push('elements:')
    for (const el of s.elements) {
      lines.push(`  - ref: ${el.ref}`)
      lines.push(`    role: ${el.role}`)
      if (el.name) lines.push(`    name: ${escapeYaml(String(el.name))}`)
      if (el.type) lines.push(`    type: ${el.type}`)
      if (el.value !== undefined) lines.push(`    value: ${escapeYaml(String(el.value))}`)
      if (el.placeholder) lines.push(`    placeholder: ${escapeYaml(String(el.placeholder))}`)
      if (el.checked !== undefined) lines.push(`    checked: ${el.checked}`)
      if (el.disabled) lines.push(`    disabled: true`)
    }
  } else {
    lines.push('elements: []')
  }
  if (s.contentText) {
    lines.push('content_text: |')
    for (const line of s.contentText.split('\n')) lines.push(`  ${line}`)
  }
  return lines.join('\n')
}

/**
 * Build a Playwright Locator for a ref returned by getPageState.
 */
export function locatorForRef(page: Page, ref: string) {
  if (!/^e\d+$/.test(ref)) {
    throw new Error(`Invalid ref "${ref}". Refs look like "e1", "e2", etc., from the page_state.`)
  }
  return page.locator(`[data-kbref="${ref}"]`)
}
