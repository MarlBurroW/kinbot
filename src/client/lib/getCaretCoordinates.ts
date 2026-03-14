/**
 * Get pixel coordinates of the caret in a textarea.
 * Uses a hidden mirror div that replicates the textarea's styling.
 */
export function getCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number,
): { top: number; left: number; height: number } {
  const mirror = document.createElement('div')
  const style = window.getComputedStyle(textarea)

  // Copy relevant styles
  const props = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle',
    'letterSpacing', 'textTransform', 'wordSpacing',
    'textIndent', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'lineHeight', 'whiteSpace', 'wordWrap', 'overflowWrap',
    'tabSize',
  ] as const

  mirror.style.position = 'absolute'
  mirror.style.visibility = 'hidden'
  mirror.style.overflow = 'hidden'
  mirror.style.width = style.width

  for (const prop of props) {
    ;(mirror.style as unknown as Record<string, string>)[prop] = style.getPropertyValue(
      prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`),
    )
  }

  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'

  const textBefore = textarea.value.substring(0, position)
  const textNode = document.createTextNode(textBefore)
  mirror.appendChild(textNode)

  const span = document.createElement('span')
  // Use a zero-width space so the span has height
  span.textContent = '\u200b'
  mirror.appendChild(span)

  document.body.appendChild(mirror)

  const spanRect = span.offsetTop
  const spanLeft = span.offsetLeft
  const lineHeight = parseInt(style.lineHeight) || parseInt(style.fontSize) * 1.2

  document.body.removeChild(mirror)

  return {
    top: spanRect - textarea.scrollTop,
    left: spanLeft,
    height: lineHeight,
  }
}
