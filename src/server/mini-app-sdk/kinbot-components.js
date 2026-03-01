/**
 * KinBot React Component Library
 * Served at /api/mini-apps/sdk/kinbot-components.js
 *
 * Ready-to-use React components that integrate with the KinBot design system.
 * All components use CSS variables from kinbot-sdk.css for automatic theme support.
 *
 * Usage in mini-apps:
 *   import { Card, Button, Input, Badge, Alert, Tabs, Modal, Spinner } from '@kinbot/components'
 */

import React, { useState, useEffect, useRef, useCallback, useId, createContext, useContext } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

function mergeStyles(base, override) {
  return override ? { ...base, ...override } : base
}

// ─── Stack ────────────────────────────────────────────────────────────────────

/**
 * Flex container for vertical or horizontal layouts.
 * @param {{ direction?: 'row'|'column', gap?: string|number, align?: string, justify?: string, wrap?: boolean, className?: string, style?: object, children: any }} props
 */
export function Stack({ direction = 'column', gap = '0.75rem', align, justify, wrap, className, style, children, ...rest }) {
  return React.createElement('div', {
    className: cn('flex', className),
    style: mergeStyles({
      flexDirection: direction,
      gap: typeof gap === 'number' ? `${gap}px` : gap,
      alignItems: align,
      justifyContent: justify,
      flexWrap: wrap ? 'wrap' : undefined,
    }, style),
    ...rest,
  }, children)
}

// ─── Divider ──────────────────────────────────────────────────────────────────

/**
 * Horizontal or vertical separator line.
 * @param {{ orientation?: 'horizontal'|'vertical', className?: string, style?: object }} props
 */
export function Divider({ orientation = 'horizontal', className, style, ...rest }) {
  const isVertical = orientation === 'vertical'
  return React.createElement('div', {
    role: 'separator',
    'aria-orientation': orientation,
    className,
    style: mergeStyles({
      borderColor: 'var(--color-border)',
      ...(isVertical
        ? { borderLeft: '1px solid var(--color-border)', alignSelf: 'stretch', minHeight: '1rem' }
        : { borderTop: '1px solid var(--color-border)', width: '100%' }),
    }, style),
    ...rest,
  })
}

// ─── Card ─────────────────────────────────────────────────────────────────────

/**
 * Card container following the KinBot card design.
 * @param {{ hover?: boolean, className?: string, style?: object, children: any }} props
 */
export function Card({ hover, className, style, children, ...rest }) {
  return React.createElement('div', {
    className: cn('card', hover && 'card-hover', className),
    style,
    ...rest,
  }, children)
}

Card.Header = function CardHeader({ className, style, children, ...rest }) {
  return React.createElement('div', { className: cn('card-header', className), style, ...rest }, children)
}

Card.Title = function CardTitle({ className, style, children, as = 'h3', ...rest }) {
  return React.createElement(as, { className: cn('card-title', className), style, ...rest }, children)
}

Card.Description = function CardDescription({ className, style, children, ...rest }) {
  return React.createElement('p', { className: cn('card-description', className), style, ...rest }, children)
}

Card.Content = function CardContent({ className, style, children, ...rest }) {
  return React.createElement('div', { className: cn('card-content', className), style, ...rest }, children)
}

Card.Footer = function CardFooter({ className, style, children, ...rest }) {
  return React.createElement('div', { className: cn('card-footer', className), style, ...rest }, children)
}

// ─── Button ───────────────────────────────────────────────────────────────────

/**
 * Themed button with variants.
 * @param {{ variant?: 'primary'|'secondary'|'destructive'|'ghost'|'shine', size?: 'sm'|'md'|'lg'|'icon', disabled?: boolean, className?: string, onClick?: Function, children: any }} props
 */
export function Button({ variant = 'primary', size = 'md', disabled, className, children, ...rest }) {
  const variantClass = variant === 'md' ? '' : `btn-${variant}`
  const sizeClass = size === 'md' ? '' : `btn-${size}`
  return React.createElement('button', {
    className: cn('btn', variantClass, sizeClass, className),
    disabled,
    ...rest,
  }, children)
}

// ─── ButtonGroup ──────────────────────────────────────────────────────────────

/**
 * Group buttons together with proper spacing.
 * @param {{ className?: string, style?: object, children: any }} props
 */
export function ButtonGroup({ className, style, children, ...rest }) {
  return React.createElement('div', {
    className: cn('inline-flex', className),
    style: mergeStyles({ gap: '0.5rem' }, style),
    role: 'group',
    ...rest,
  }, children)
}

// ─── Input ────────────────────────────────────────────────────────────────────

/**
 * Text input field.
 * @param {{ label?: string, error?: string, className?: string }} props
 */
export const Input = React.forwardRef(function Input({ label, error, className, id: propId, style, ...rest }, ref) {
  const autoId = useId()
  const id = propId || autoId
  return React.createElement('div', { style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.375rem' }, style) },
    label && React.createElement('label', { htmlFor: id, className: 'label' }, label),
    React.createElement('input', {
      ref,
      id,
      className: cn('input', error && 'border-destructive', className),
      'aria-invalid': error ? 'true' : undefined,
      'aria-describedby': error ? `${id}-error` : undefined,
      ...rest,
    }),
    error && React.createElement('p', {
      id: `${id}-error`,
      style: { color: 'var(--color-destructive)', fontSize: '0.8125rem', margin: 0 },
    }, error),
  )
})

// ─── Textarea ─────────────────────────────────────────────────────────────────

/**
 * Textarea field.
 * @param {{ label?: string, error?: string, className?: string }} props
 */
export const Textarea = React.forwardRef(function Textarea({ label, error, className, id: propId, style, ...rest }, ref) {
  const autoId = useId()
  const id = propId || autoId
  return React.createElement('div', { style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.375rem' }, style) },
    label && React.createElement('label', { htmlFor: id, className: 'label' }, label),
    React.createElement('textarea', {
      ref,
      id,
      className: cn('textarea', error && 'border-destructive', className),
      'aria-invalid': error ? 'true' : undefined,
      ...rest,
    }),
    error && React.createElement('p', {
      style: { color: 'var(--color-destructive)', fontSize: '0.8125rem', margin: 0 },
    }, error),
  )
})

// ─── Select ───────────────────────────────────────────────────────────────────

/**
 * Native select field styled to match KinBot.
 * @param {{ label?: string, options: Array<{value: string, label: string}>, placeholder?: string, error?: string, className?: string }} props
 */
export const Select = React.forwardRef(function Select({ label, options = [], placeholder, error, className, id: propId, style, ...rest }, ref) {
  const autoId = useId()
  const id = propId || autoId
  return React.createElement('div', { style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.375rem' }, style) },
    label && React.createElement('label', { htmlFor: id, className: 'label' }, label),
    React.createElement('select', {
      ref,
      id,
      className: cn('input', className),
      'aria-invalid': error ? 'true' : undefined,
      ...rest,
    },
      placeholder && React.createElement('option', { value: '', disabled: true }, placeholder),
      ...options.map(opt =>
        React.createElement('option', { key: opt.value, value: opt.value }, opt.label)
      ),
    ),
    error && React.createElement('p', {
      style: { color: 'var(--color-destructive)', fontSize: '0.8125rem', margin: 0 },
    }, error),
  )
})

// ─── Checkbox ─────────────────────────────────────────────────────────────────

/**
 * Checkbox with label.
 * @param {{ label?: string, checked?: boolean, onChange?: Function, className?: string }} props
 */
export function Checkbox({ label, className, id: propId, style, ...rest }) {
  const autoId = useId()
  const id = propId || autoId
  return React.createElement('div', {
    className: cn('inline-flex', className),
    style: mergeStyles({ alignItems: 'center', gap: '0.5rem' }, style),
  },
    React.createElement('input', {
      type: 'checkbox',
      id,
      style: { width: '1rem', height: '1rem', accentColor: 'var(--color-primary)', cursor: 'pointer' },
      ...rest,
    }),
    label && React.createElement('label', {
      htmlFor: id,
      style: { cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-foreground)' },
    }, label),
  )
}

// ─── Switch ───────────────────────────────────────────────────────────────────

const switchTrackStyle = (checked) => ({
  position: 'relative',
  width: '2.5rem',
  height: '1.375rem',
  borderRadius: 'var(--radius-full)',
  backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-muted)',
  cursor: 'pointer',
  transition: 'background-color 0.2s',
  border: 'none',
  padding: 0,
  flexShrink: 0,
})

const switchThumbStyle = (checked) => ({
  position: 'absolute',
  top: '2px',
  left: checked ? '1.25rem' : '2px',
  width: '1.125rem',
  height: '1.125rem',
  borderRadius: 'var(--radius-full)',
  backgroundColor: 'white',
  transition: 'left 0.2s',
  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
})

/**
 * Toggle switch.
 * @param {{ label?: string, checked?: boolean, onChange?: Function, disabled?: boolean }} props
 */
export function Switch({ label, checked = false, onChange, disabled, className, style, ...rest }) {
  const autoId = useId()
  return React.createElement('div', {
    className: cn('inline-flex', className),
    style: mergeStyles({ alignItems: 'center', gap: '0.5rem' }, style),
  },
    React.createElement('button', {
      type: 'button',
      role: 'switch',
      'aria-checked': checked,
      disabled,
      onClick: () => onChange && onChange(!checked),
      style: mergeStyles(switchTrackStyle(checked), disabled ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
      ...rest,
    },
      React.createElement('span', { style: switchThumbStyle(checked) }),
    ),
    label && React.createElement('label', {
      style: { cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.875rem', color: 'var(--color-foreground)' },
      onClick: () => !disabled && onChange && onChange(!checked),
    }, label),
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

/**
 * Inline badge/tag.
 * @param {{ variant?: 'default'|'primary'|'destructive'|'success'|'warning'|'outline', className?: string, children: any }} props
 */
export function Badge({ variant = 'default', className, children, ...rest }) {
  const variantClass = variant === 'default' ? '' : `badge-${variant}`
  return React.createElement('span', {
    className: cn('badge', variantClass, className),
    ...rest,
  }, children)
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

/**
 * Removable tag (extends Badge with close button).
 * @param {{ onRemove?: Function, variant?: string, className?: string, children: any }} props
 */
export function Tag({ onRemove, variant, className, children, ...rest }) {
  return React.createElement(Badge, { variant, className: cn(className), ...rest },
    children,
    onRemove && React.createElement('button', {
      type: 'button',
      onClick: onRemove,
      'aria-label': 'Remove',
      style: { marginLeft: '0.25rem', cursor: 'pointer', background: 'none', border: 'none', padding: 0, color: 'inherit', fontSize: '1rem', lineHeight: 1 },
    }, '\u00d7'),
  )
}

// ─── Stat ─────────────────────────────────────────────────────────────────────

/**
 * Stat display (number + label).
 * @param {{ value: string|number, label: string, trend?: string, trendUp?: boolean, className?: string }} props
 */
export function Stat({ value, label, trend, trendUp, className, style, ...rest }) {
  return React.createElement('div', {
    className,
    style: mergeStyles({ textAlign: 'center', padding: '0.5rem' }, style),
    ...rest,
  },
    React.createElement('div', {
      style: { fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-foreground)', lineHeight: 1.2 },
    }, value),
    React.createElement('div', {
      style: { fontSize: '0.8125rem', color: 'var(--color-muted-foreground)', marginTop: '0.25rem' },
    }, label),
    trend && React.createElement('div', {
      style: { fontSize: '0.75rem', marginTop: '0.25rem', color: trendUp ? 'var(--color-success)' : 'var(--color-destructive)' },
    }, trend),
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

/**
 * Avatar circle (image or initials fallback).
 * @param {{ src?: string, alt?: string, initials?: string, size?: number, className?: string }} props
 */
export function Avatar({ src, alt = '', initials, size = 40, className, style, ...rest }) {
  const baseStyle = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-muted)',
    color: 'var(--color-muted-foreground)',
    fontWeight: 600,
    fontSize: `${size * 0.4}px`,
    flexShrink: 0,
  }

  if (src) {
    return React.createElement('img', {
      src,
      alt,
      className,
      style: mergeStyles(baseStyle, style),
      ...rest,
    })
  }

  return React.createElement('div', {
    className,
    style: mergeStyles(baseStyle, style),
    'aria-label': alt || initials,
    ...rest,
  }, initials || (alt ? alt.charAt(0).toUpperCase() : '?'))
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

/**
 * Simple tooltip on hover.
 * @param {{ text: string, position?: 'top'|'bottom'|'left'|'right', children: any }} props
 */
export function Tooltip({ text, position = 'top', children, className, ...rest }) {
  const [show, setShow] = useState(false)
  const posStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '6px' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '6px' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '6px' },
  }

  return React.createElement('div', {
    className,
    style: { position: 'relative', display: 'inline-flex' },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false),
    onFocus: () => setShow(true),
    onBlur: () => setShow(false),
    ...rest,
  },
    children,
    show && React.createElement('div', {
      role: 'tooltip',
      style: {
        position: 'absolute',
        ...posStyles[position],
        padding: '0.375rem 0.625rem',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--color-foreground)',
        color: 'var(--color-background)',
        fontSize: '0.75rem',
        whiteSpace: 'nowrap',
        zIndex: 50,
        pointerEvents: 'none',
        animation: 'fade-in 0.15s ease-out',
      },
    }, text),
  )
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

/**
 * Animated progress bar.
 * @param {{ value: number, max?: number, color?: string, height?: number, showLabel?: boolean, className?: string }} props
 */
export function ProgressBar({ value = 0, max = 100, color, height = 8, showLabel, className, style, ...rest }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return React.createElement('div', {
    className,
    style: mergeStyles({ width: '100%' }, style),
    ...rest,
  },
    showLabel && React.createElement('div', {
      style: { fontSize: '0.75rem', color: 'var(--color-muted-foreground)', marginBottom: '0.25rem', textAlign: 'right' },
    }, `${Math.round(pct)}%`),
    React.createElement('div', {
      role: 'progressbar',
      'aria-valuenow': value,
      'aria-valuemin': 0,
      'aria-valuemax': max,
      style: {
        width: '100%',
        height: `${height}px`,
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-muted)',
        overflow: 'hidden',
      },
    },
      React.createElement('div', {
        style: {
          width: `${pct}%`,
          height: '100%',
          borderRadius: 'var(--radius-full)',
          backgroundColor: color || 'var(--color-primary)',
          transition: 'width 0.3s ease',
        },
      }),
    ),
  )
}

// ─── Alert ────────────────────────────────────────────────────────────────────

const alertStyles = {
  info: { bg: 'var(--color-info)', fg: 'var(--color-info-foreground)', border: 'var(--color-info)' },
  success: { bg: 'var(--color-success)', fg: 'var(--color-success-foreground)', border: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning)', fg: 'var(--color-warning-foreground)', border: 'var(--color-warning)' },
  error: { bg: 'var(--color-destructive)', fg: 'var(--color-destructive-foreground)', border: 'var(--color-destructive)' },
}

/**
 * Alert banner.
 * @param {{ variant?: 'info'|'success'|'warning'|'error', title?: string, dismissible?: boolean, onDismiss?: Function, className?: string, children: any }} props
 */
export function Alert({ variant = 'info', title, dismissible, onDismiss, className, style, children, ...rest }) {
  const colors = alertStyles[variant] || alertStyles.info
  return React.createElement('div', {
    role: 'alert',
    className,
    style: mergeStyles({
      padding: '0.75rem 1rem',
      borderRadius: 'var(--radius-lg)',
      borderLeft: `4px solid ${colors.border}`,
      backgroundColor: `color-mix(in oklch, ${colors.bg} 12%, transparent)`,
      color: 'var(--color-foreground)',
    }, style),
    ...rest,
  },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
      React.createElement('div', null,
        title && React.createElement('div', {
          style: { fontWeight: 600, marginBottom: '0.25rem' },
        }, title),
        React.createElement('div', {
          style: { fontSize: '0.875rem' },
        }, children),
      ),
      dismissible && React.createElement('button', {
        type: 'button',
        onClick: onDismiss,
        'aria-label': 'Dismiss',
        style: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--color-muted-foreground)', fontSize: '1.125rem' },
      }, '\u00d7'),
    ),
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

/**
 * Loading spinner.
 * @param {{ size?: number, color?: string, className?: string }} props
 */
export function Spinner({ size = 24, color, className, style, ...rest }) {
  return React.createElement('div', {
    role: 'status',
    'aria-label': 'Loading',
    className,
    style: mergeStyles({
      width: `${size}px`,
      height: `${size}px`,
      border: `2px solid var(--color-muted)`,
      borderTopColor: color || 'var(--color-primary)',
      borderRadius: '50%',
      animation: 'spin 0.6s linear infinite',
      display: 'inline-block',
    }, style),
    ...rest,
  })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

/**
 * Skeleton loading placeholder.
 * @param {{ width?: string, height?: string, rounded?: boolean, circle?: boolean, className?: string }} props
 */
export function Skeleton({ width = '100%', height = '1rem', rounded, circle, className, style, ...rest }) {
  return React.createElement('div', {
    className: cn('skeleton', className),
    style: mergeStyles({
      width: circle ? height : width,
      height,
      borderRadius: circle ? '50%' : rounded ? 'var(--radius-lg)' : 'var(--radius-md)',
    }, style),
    ...rest,
  })
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

/**
 * Empty state placeholder.
 * @param {{ icon?: string, title: string, description?: string, action?: any, className?: string }} props
 */
export function EmptyState({ icon, title, description, action, className, style, ...rest }) {
  return React.createElement('div', {
    className,
    style: mergeStyles({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      gap: '0.75rem',
    }, style),
    ...rest,
  },
    icon && React.createElement('div', {
      style: { fontSize: '2.5rem' },
    }, icon),
    React.createElement('div', {
      style: { fontWeight: 600, color: 'var(--color-foreground)', fontSize: '1rem' },
    }, title),
    description && React.createElement('div', {
      style: { color: 'var(--color-muted-foreground)', fontSize: '0.875rem', maxWidth: '24rem' },
    }, description),
    action,
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

/**
 * Tab navigation.
 * @param {{ tabs: Array<{id: string, label: string, icon?: string}>, active: string, onChange: Function, className?: string }} props
 */
export function Tabs({ tabs = [], active, onChange, className, style, ...rest }) {
  return React.createElement('div', {
    role: 'tablist',
    className,
    style: mergeStyles({
      display: 'flex',
      gap: '0.25rem',
      borderBottom: '1px solid var(--color-border)',
      paddingBottom: 0,
    }, style),
    ...rest,
  },
    ...tabs.map(tab =>
      React.createElement('button', {
        key: tab.id,
        role: 'tab',
        'aria-selected': active === tab.id,
        onClick: () => onChange(tab.id),
        style: {
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          fontWeight: active === tab.id ? 600 : 400,
          color: active === tab.id ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
          background: 'none',
          border: 'none',
          borderBottom: active === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
          cursor: 'pointer',
          transition: 'color 0.15s, border-color 0.15s',
          marginBottom: '-1px',
        },
      }, tab.icon ? `${tab.icon} ${tab.label}` : tab.label),
    ),
  )
}

// ─── Table ────────────────────────────────────────────────────────────────────

/**
 * Data table using the CSS `.table` class.
 * @param {{ columns: Array<{key: string, label: string, align?: string, render?: Function}>, data: Array<object>, onRowClick?: Function, className?: string }} props
 */
export function Table({ columns = [], data = [], onRowClick, className, style, ...rest }) {
  return React.createElement('div', { style: mergeStyles({ overflowX: 'auto' }, style) },
    React.createElement('table', {
      className: cn('table', className),
      ...rest,
    },
      React.createElement('thead', null,
        React.createElement('tr', null,
          ...columns.map(col =>
            React.createElement('th', {
              key: col.key,
              style: col.align ? { textAlign: col.align } : undefined,
            }, col.label),
          ),
        ),
      ),
      React.createElement('tbody', null,
        ...data.map((row, i) =>
          React.createElement('tr', {
            key: row.id ?? i,
            onClick: onRowClick ? () => onRowClick(row, i) : undefined,
            style: onRowClick ? { cursor: 'pointer' } : undefined,
          },
            ...columns.map(col =>
              React.createElement('td', {
                key: col.key,
                style: col.align ? { textAlign: col.align } : undefined,
              }, col.render ? col.render(row[col.key], row, i) : row[col.key]),
            ),
          ),
        ),
      ),
    ),
  )
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Simple styled list.
 * @param {{ items: Array<{id?: string, content: any, onClick?: Function}>, divided?: boolean, className?: string }} props
 */
export function List({ items = [], divided = true, className, style, ...rest }) {
  return React.createElement('div', {
    className,
    role: 'list',
    style: mergeStyles({
      display: 'flex',
      flexDirection: 'column',
    }, style),
    ...rest,
  },
    ...items.map((item, i) =>
      React.createElement('div', {
        key: item.id ?? i,
        role: 'listitem',
        onClick: item.onClick,
        style: {
          padding: '0.625rem 0',
          borderBottom: divided && i < items.length - 1 ? '1px solid var(--color-border)' : undefined,
          cursor: item.onClick ? 'pointer' : undefined,
        },
      }, item.content),
    ),
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

/**
 * Page navigation.
 * @param {{ page: number, totalPages: number, onChange: Function, className?: string }} props
 */
export function Pagination({ page = 1, totalPages = 1, onChange, className, style, ...rest }) {
  const pages = []
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
      pages.push(p)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }

  return React.createElement('div', {
    className,
    style: mergeStyles({ display: 'flex', alignItems: 'center', gap: '0.25rem' }, style),
    'aria-label': 'Pagination',
    ...rest,
  },
    React.createElement('button', {
      className: 'btn btn-ghost btn-sm',
      disabled: page <= 1,
      onClick: () => onChange(page - 1),
      'aria-label': 'Previous page',
    }, '\u2190'),
    ...pages.map((p, i) =>
      p === '...'
        ? React.createElement('span', { key: `e${i}`, style: { padding: '0 0.25rem', color: 'var(--color-muted-foreground)' } }, '...')
        : React.createElement('button', {
            key: p,
            className: cn('btn btn-sm', p === page ? 'btn-primary' : 'btn-ghost'),
            onClick: () => onChange(p),
            'aria-current': p === page ? 'page' : undefined,
          }, p),
    ),
    React.createElement('button', {
      className: 'btn btn-ghost btn-sm',
      disabled: page >= totalPages,
      onClick: () => onChange(page + 1),
      'aria-label': 'Next page',
    }, '\u2192'),
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

/**
 * Modal dialog (renders in the iframe, not the parent).
 * For parent-level dialogs, use KinBot.confirm() or KinBot.prompt() from the SDK.
 * @param {{ open: boolean, onClose: Function, title?: string, size?: 'sm'|'md'|'lg', children: any }} props
 */
export function Modal({ open, onClose, title, size = 'md', className, children, ...rest }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  const maxWidths = { sm: '24rem', md: '32rem', lg: '48rem' }

  return React.createElement('div', {
    ref: dialogRef,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    },
    ...rest,
  },
    // Backdrop
    React.createElement('div', {
      onClick: onClose,
      style: {
        position: 'absolute',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        animation: 'fade-in 0.15s ease-out',
      },
    }),
    // Panel
    React.createElement('div', {
      className: cn('card', className),
      style: {
        position: 'relative',
        width: '100%',
        maxWidth: maxWidths[size],
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        animation: 'scale-in 0.2s ease-out',
      },
    },
      title && React.createElement('div', { className: 'card-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('h3', { className: 'card-title', style: { margin: 0 } }, title),
        React.createElement('button', {
          type: 'button',
          onClick: onClose,
          'aria-label': 'Close',
          style: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--color-muted-foreground)', fontSize: '1.25rem' },
        }, '\u00d7'),
      ),
      React.createElement('div', { className: 'card-content', style: { overflowY: 'auto', flex: 1 } }, children),
    ),
  )
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

/**
 * Slide-in drawer panel.
 * @param {{ open: boolean, onClose: Function, title?: string, side?: 'left'|'right', width?: string, children: any }} props
 */
export function Drawer({ open, onClose, title, side = 'right', width = '24rem', className, children, ...rest }) {
  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  const isLeft = side === 'left'

  return React.createElement('div', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
    style: { position: 'fixed', inset: 0, zIndex: 100, display: 'flex' },
    ...rest,
  },
    React.createElement('div', {
      onClick: onClose,
      style: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', animation: 'fade-in 0.15s ease-out' },
    }),
    React.createElement('div', {
      className: cn('card', className),
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        [isLeft ? 'left' : 'right']: 0,
        width,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        animation: `slide-in-${side} 0.2s ease-out`,
      },
    },
      title && React.createElement('div', { className: 'card-header', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('h3', { className: 'card-title', style: { margin: 0 } }, title),
        React.createElement('button', {
          type: 'button',
          onClick: onClose,
          'aria-label': 'Close',
          style: { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem', color: 'var(--color-muted-foreground)', fontSize: '1.25rem' },
        }, '\u00d7'),
      ),
      React.createElement('div', { className: 'card-content', style: { overflowY: 'auto', flex: 1 } }, children),
    ),
  )
}
