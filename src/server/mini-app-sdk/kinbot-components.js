/**
 * KinBot React Component Library
 * Served at /api/mini-apps/sdk/kinbot-components.js
 *
 * Ready-to-use React components that integrate with the KinBot design system.
 * All components use CSS variables from kinbot-sdk.css for automatic theme support.
 *
 * Usage in mini-apps:
 *   import { Card, Button, Input, Badge, Alert, Tabs, Modal, Spinner, Accordion, DropdownMenu, DataGrid, Panel, RadioGroup, Slider, DatePicker, Stepper, StepperContent, FileUpload, CodeBlock, Timeline, AvatarGroup, NumberInput, Combobox, TagInput } from '@kinbot/components'
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

// ─── Grid ─────────────────────────────────────────────────────────────────────

/**
 * CSS Grid layout with responsive column support.
 * @param {{ columns?: number|string, minChildWidth?: string, gap?: string|number, rowGap?: string|number, colGap?: string|number, className?: string, style?: object, children: any }} props
 *
 * Usage:
 *   <Grid columns={3} gap="1rem">...</Grid>
 *   <Grid minChildWidth="250px">...</Grid>  // auto-fit responsive
 */
export function Grid({ columns, minChildWidth, gap = '1rem', rowGap, colGap, className, style, children, ...rest }) {
  const gapVal = typeof gap === 'number' ? `${gap}px` : gap
  let gridTemplateColumns
  if (minChildWidth) {
    gridTemplateColumns = `repeat(auto-fit, minmax(${minChildWidth}, 1fr))`
  } else if (typeof columns === 'number') {
    gridTemplateColumns = `repeat(${columns}, 1fr)`
  } else if (typeof columns === 'string') {
    gridTemplateColumns = columns
  } else {
    gridTemplateColumns = 'repeat(auto-fit, minmax(200px, 1fr))'
  }
  return React.createElement('div', {
    className,
    style: mergeStyles({
      display: 'grid',
      gridTemplateColumns,
      gap: (!rowGap && !colGap) ? gapVal : undefined,
      rowGap: rowGap ? (typeof rowGap === 'number' ? `${rowGap}px` : rowGap) : undefined,
      columnGap: colGap ? (typeof colGap === 'number' ? `${colGap}px` : colGap) : undefined,
    }, style),
    ...rest,
  }, children)
}

/**
 * Grid item with optional span control.
 * @param {{ colSpan?: number, rowSpan?: number, className?: string, style?: object, children: any }} props
 */
Grid.Item = function GridItem({ colSpan, rowSpan, className, style, children, ...rest }) {
  return React.createElement('div', {
    className,
    style: mergeStyles({
      gridColumn: colSpan ? `span ${colSpan}` : undefined,
      gridRow: rowSpan ? `span ${rowSpan}` : undefined,
    }, style),
    ...rest,
  }, children)
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

/**
 * Breadcrumb navigation.
 * @param {{ items: Array<{label: string, href?: string, onClick?: function}>, separator?: string, className?: string, style?: object }} props
 */
export function Breadcrumbs({ items = [], separator = '/', className, style, ...rest }) {
  return React.createElement('nav', {
    'aria-label': 'Breadcrumb',
    className,
    style: mergeStyles({ fontSize: '0.875rem' }, style),
    ...rest,
  },
    React.createElement('ol', {
      style: { display: 'flex', alignItems: 'center', gap: '0.375rem', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' },
    },
      items.map((item, i) => {
        const isLast = i === items.length - 1
        const elements = []
        if (i > 0) {
          elements.push(React.createElement('li', {
            key: `sep-${i}`,
            'aria-hidden': 'true',
            style: { color: 'var(--color-muted-foreground)', userSelect: 'none' },
          }, separator))
        }
        const linkStyle = isLast
          ? { color: 'var(--color-foreground)', fontWeight: 500, cursor: 'default', textDecoration: 'none' }
          : { color: 'var(--color-muted-foreground)', textDecoration: 'none', cursor: 'pointer' }
        const el = (item.href && !isLast)
          ? React.createElement('a', { href: item.href, style: linkStyle }, item.label)
          : React.createElement('span', {
              style: linkStyle,
              role: (!isLast && item.onClick) ? 'button' : undefined,
              tabIndex: (!isLast && item.onClick) ? 0 : undefined,
              onClick: !isLast ? item.onClick : undefined,
              onKeyDown: (!isLast && item.onClick) ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.onClick(e) } } : undefined,
            }, item.label)
        elements.push(React.createElement('li', {
          key: `item-${i}`,
          'aria-current': isLast ? 'page' : undefined,
        }, el))
        return elements
      }).flat(),
    ),
  )
}

// ─── Popover ──────────────────────────────────────────────────────────────────

/**
 * Popover attached to a trigger element. Toggles on click, closes on outside click or Escape.
 * @param {{ trigger: any, content: any, placement?: 'top'|'bottom'|'left'|'right', open?: boolean, onOpenChange?: function, className?: string, style?: object }} props
 */
export function Popover({ trigger, content, placement = 'bottom', open: controlledOpen, onOpenChange, className, style, ...rest }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen
  const setOpen = useCallback((v) => {
    if (!isControlled) setInternalOpen(v)
    if (onOpenChange) onOpenChange(v)
  }, [isControlled, onOpenChange])
  const containerRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    function handleEsc(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, setOpen])

  const placementStyles = {
    top: { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '0.5rem' },
    bottom: { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '0.5rem' },
    left: { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '0.5rem' },
    right: { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '0.5rem' },
  }

  return React.createElement('div', {
    ref: containerRef,
    style: mergeStyles({ position: 'relative', display: 'inline-block' }, style),
    ...rest,
  },
    React.createElement('div', {
      onClick: () => setOpen(!isOpen),
      style: { cursor: 'pointer' },
    }, trigger),
    isOpen && React.createElement('div', {
      role: 'dialog',
      className: cn('card', className),
      style: {
        position: 'absolute',
        zIndex: 50,
        minWidth: '12rem',
        padding: '0.75rem',
        animation: 'fade-in 0.15s ease-out',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        ...placementStyles[placement] || placementStyles.bottom,
      },
    }, content),
  )
}

// ─── Form ─────────────────────────────────────────────────────────────────────

const FormContext = createContext(null)

/**
 * Built-in validation rules.
 * Each rule is a function (value, param?) => string|null (null = valid).
 */
const validators = {
  required: (v) => {
    if (v === undefined || v === null || v === '' || (typeof v === 'boolean' && !v)) return 'This field is required'
    return null
  },
  email: (v) => {
    if (!v) return null // let required handle empty
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email address'
  },
  minLength: (v, min) => {
    if (!v) return null
    return String(v).length >= min ? null : `Must be at least ${min} characters`
  },
  maxLength: (v, max) => {
    if (!v) return null
    return String(v).length <= max ? null : `Must be at most ${max} characters`
  },
  min: (v, min) => {
    if (v === '' || v === undefined || v === null) return null
    return Number(v) >= min ? null : `Must be at least ${min}`
  },
  max: (v, max) => {
    if (v === '' || v === undefined || v === null) return null
    return Number(v) <= max ? null : `Must be at most ${max}`
  },
  pattern: (v, regex) => {
    if (!v) return null
    const re = typeof regex === 'string' ? new RegExp(regex) : regex
    return re.test(v) ? null : 'Invalid format'
  },
  match: (v, _param, allValues, fieldName) => {
    if (!v) return null
    return v === allValues[_param] ? null : `Must match ${_param}`
  },
}

function runValidation(value, rules, allValues, fieldName) {
  if (!rules) return null
  for (const rule of rules) {
    let msg = null
    if (typeof rule === 'string') {
      // shorthand: "required", "email"
      if (validators[rule]) msg = validators[rule](value)
    } else if (typeof rule === 'function') {
      // custom: (value, allValues) => string|null
      msg = rule(value, allValues)
    } else if (typeof rule === 'object' && rule.type) {
      // { type: 'minLength', value: 3, message?: 'Too short' }
      const fn = validators[rule.type]
      if (fn) {
        msg = fn(value, rule.value, allValues, fieldName)
        if (msg && rule.message) msg = rule.message
      }
    }
    if (msg) return msg
  }
  return null
}

/**
 * Form component with validation support.
 *
 * @param {{
 *   onSubmit: (values: object) => void|Promise<void>,
 *   initialValues?: object,
 *   validateOnChange?: boolean,
 *   validateOnBlur?: boolean,
 *   className?: string,
 *   style?: object,
 *   children: any
 * }} props
 *
 * Usage:
 *   <Form onSubmit={vals => console.log(vals)} initialValues={{ name: '' }}>
 *     <Form.Field name="name" label="Name" rules={['required', { type: 'minLength', value: 2 }]}>
 *       <Input />
 *     </Form.Field>
 *     <Form.Field name="email" label="Email" rules={['required', 'email']}>
 *       <Input type="email" />
 *     </Form.Field>
 *     <Form.Actions>
 *       <Button type="submit">Submit</Button>
 *       <Form.Reset variant="ghost">Reset</Form.Reset>
 *     </Form.Actions>
 *   </Form>
 *
 * The child of Form.Field receives: value, onChange, onBlur, error, id props automatically.
 * For custom inputs, ensure they accept these props.
 */
export function Form({ onSubmit, initialValues = {}, validateOnChange = false, validateOnBlur = true, className, style, children, ...rest }) {
  const [values, setValues] = useState(() => ({ ...initialValues }))
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fieldsRef = useRef({}) // { name: { rules } }

  const registerField = useCallback((name, rules) => {
    fieldsRef.current[name] = { rules }
  }, [])

  const unregisterField = useCallback((name) => {
    delete fieldsRef.current[name]
  }, [])

  const setValue = useCallback((name, val) => {
    setValues(prev => {
      const next = { ...prev, [name]: val }
      return next
    })
  }, [])

  const setFieldError = useCallback((name, error) => {
    setErrors(prev => {
      if (prev[name] === error) return prev
      const next = { ...prev }
      if (error) next[name] = error; else delete next[name]
      return next
    })
  }, [])

  const validateField = useCallback((name, currentValues) => {
    const field = fieldsRef.current[name]
    if (!field) return null
    const error = runValidation(currentValues[name], field.rules, currentValues, name)
    setFieldError(name, error)
    return error
  }, [setFieldError])

  const validateAll = useCallback((currentValues) => {
    const newErrors = {}
    let hasError = false
    for (const name of Object.keys(fieldsRef.current)) {
      const error = runValidation(currentValues[name], fieldsRef.current[name].rules, currentValues, name)
      if (error) {
        newErrors[name] = error
        hasError = true
      }
    }
    setErrors(newErrors)
    return !hasError
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setSubmitted(true)
    // Touch all fields
    const allTouched = {}
    for (const name of Object.keys(fieldsRef.current)) allTouched[name] = true
    setTouched(allTouched)

    const currentValues = { ...values }
    if (!validateAll(currentValues)) return

    setSubmitting(true)
    try {
      await onSubmit?.(currentValues)
    } finally {
      setSubmitting(false)
    }
  }, [values, validateAll, onSubmit])

  const reset = useCallback(() => {
    setValues({ ...initialValues })
    setErrors({})
    setTouched({})
    setSubmitted(false)
    setSubmitting(false)
  }, [initialValues])

  const ctx = {
    values, errors, touched, submitting, submitted,
    setValue, setFieldError, validateField, registerField, unregisterField,
    setTouched, validateOnChange, validateOnBlur, reset,
  }

  return React.createElement(FormContext.Provider, { value: ctx },
    React.createElement('form', {
      onSubmit: handleSubmit,
      noValidate: true,
      className,
      style,
      ...rest,
    }, typeof children === 'function' ? children({ values, errors, submitting, submitted, reset }) : children),
  )
}

/**
 * Form field wrapper with automatic validation binding.
 * Clones the child element and injects value/onChange/onBlur/error/id props.
 *
 * @param {{
 *   name: string,
 *   label?: string,
 *   rules?: Array<string | Function | {type: string, value?: any, message?: string}>,
 *   helpText?: string,
 *   children: ReactElement
 * }} props
 */
Form.Field = function FormField({ name, label, rules, helpText, children, style, ...rest }) {
  const ctx = useContext(FormContext)
  const autoId = useId()
  const id = `field-${name}-${autoId}`

  useEffect(() => {
    ctx.registerField(name, rules)
    return () => ctx.unregisterField(name)
  }, [name, rules])

  const value = ctx.values[name] ?? ''
  const error = (ctx.touched[name] || ctx.submitted) ? ctx.errors[name] : undefined

  const handleChange = useCallback((eOrVal) => {
    let val
    if (eOrVal && eOrVal.target) {
      const t = eOrVal.target
      val = t.type === 'checkbox' ? t.checked : t.value
    } else {
      val = eOrVal
    }
    ctx.setValue(name, val)
    if (ctx.validateOnChange || ctx.submitted) {
      // Validate after state update via setTimeout
      setTimeout(() => {
        ctx.validateField(name, { ...ctx.values, [name]: val })
      }, 0)
    }
  }, [name, ctx])

  const handleBlur = useCallback(() => {
    ctx.setTouched(prev => ({ ...prev, [name]: true }))
    if (ctx.validateOnBlur) {
      ctx.validateField(name, ctx.values)
    }
  }, [name, ctx])

  // Clone child with injected props
  const child = React.Children.only(children)
  const isCheckboxOrSwitch = child.type === Checkbox || child.type === Switch ||
    (child.props && child.props.type === 'checkbox')

  const injectedProps = {
    id,
    [isCheckboxOrSwitch ? 'checked' : 'value']: isCheckboxOrSwitch ? !!value : value,
    onChange: handleChange,
    onBlur: handleBlur,
    error: error,
  }

  // For checkbox/switch, pass label through the component rather than the field wrapper
  if (isCheckboxOrSwitch && label && !child.props.label) {
    injectedProps.label = label
  }

  return React.createElement('div', {
    style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.375rem' }, style),
    ...rest,
  },
    label && !isCheckboxOrSwitch && React.createElement('label', {
      htmlFor: id,
      className: 'label',
    }, label),
    React.cloneElement(child, injectedProps),
    helpText && !error && React.createElement('p', {
      style: { color: 'var(--color-muted-foreground)', fontSize: '0.8125rem', margin: 0 },
    }, helpText),
    error && React.createElement('p', {
      id: `${id}-error`,
      role: 'alert',
      style: { color: 'var(--color-destructive)', fontSize: '0.8125rem', margin: 0 },
    }, error),
  )
}

/**
 * Form actions container (buttons area).
 * @param {{ align?: 'left'|'center'|'right'|'between', className?: string, children: any }} props
 */
Form.Actions = function FormActions({ align = 'left', className, style, children, ...rest }) {
  const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end', between: 'space-between' }
  return React.createElement('div', {
    className,
    style: mergeStyles({
      display: 'flex',
      gap: '0.5rem',
      justifyContent: justifyMap[align] || 'flex-start',
      paddingTop: '0.5rem',
    }, style),
    ...rest,
  }, children)
}

/**
 * Reset button that clears form to initial values.
 * @param {{ variant?: string, children: any }} props
 */
Form.Reset = function FormReset({ children = 'Reset', ...rest }) {
  const ctx = useContext(FormContext)
  return React.createElement(Button, {
    type: 'button',
    onClick: ctx.reset,
    ...rest,
  }, children)
}

/**
 * Submit button with automatic loading state.
 * @param {{ children: any, loadingText?: string }} props
 */
Form.Submit = function FormSubmit({ children = 'Submit', loadingText = 'Submitting...', disabled, ...rest }) {
  const ctx = useContext(FormContext)
  return React.createElement(Button, {
    type: 'submit',
    disabled: disabled || ctx.submitting,
    ...rest,
  }, ctx.submitting ? loadingText : children)
}

// ─── DataGrid ─────────────────────────────────────────────────────────────────

/**
 * Feature-rich data table with sorting, filtering, pagination, and row selection.
 *
 * Columns shape: { key, label, sortable?, filterable?, align?, width?, render?(value, row, index) }
 *
 * @param {{
 *   columns: Array<{ key: string, label: string, sortable?: boolean, filterable?: boolean, align?: string, width?: string, render?: Function }>,
 *   data: Array<object>,
 *   pageSize?: number,
 *   pageSizeOptions?: number[],
 *   selectable?: boolean,
 *   onSelectionChange?: (selectedRows: object[]) => void,
 *   onRowClick?: (row: object, index: number) => void,
 *   searchable?: boolean,
 *   searchPlaceholder?: string,
 *   emptyText?: string,
 *   striped?: boolean,
 *   compact?: boolean,
 *   stickyHeader?: boolean,
 *   maxHeight?: string,
 *   className?: string,
 *   style?: object,
 * }} props
 */
export function DataGrid({
  columns = [],
  data = [],
  pageSize: initialPageSize = 10,
  pageSizeOptions = [5, 10, 25, 50],
  selectable = false,
  onSelectionChange,
  onRowClick,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyText = 'No data',
  striped = false,
  compact = false,
  stickyHeader = false,
  maxHeight,
  className,
  style,
  ...rest
}) {
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc') // 'asc' | 'desc'
  const [filters, setFilters] = useState({}) // { [key]: string }
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)
  const [selected, setSelected] = useState(new Set()) // Set of row indices (in filtered data)

  // Reset page when filters/search/sort change
  useEffect(() => { setPage(1) }, [search, sortKey, sortDir, JSON.stringify(filters)])
  // Reset selection when data changes
  useEffect(() => { setSelected(new Set()); onSelectionChange?.([]) }, [data.length])

  // ── Filter + search ──
  const filtered = React.useMemo(() => {
    let rows = data
    // Column filters
    const activeFilters = Object.entries(filters).filter(([, v]) => v)
    if (activeFilters.length) {
      rows = rows.filter(row =>
        activeFilters.every(([key, val]) =>
          String(row[key] ?? '').toLowerCase().includes(val.toLowerCase())
        )
      )
    }
    // Global search
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(row =>
        columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
      )
    }
    return rows
  }, [data, filters, search, columns])

  // ── Sort ──
  const sorted = React.useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find(c => c.key === sortKey)
    if (!col) return filtered
    return [...filtered].sort((a, b) => {
      const va = a[sortKey], vb = b[sortKey]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      let cmp = 0
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb
      else cmp = String(va).localeCompare(String(vb), undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [filtered, sortKey, sortDir, columns])

  // ── Paginate ──
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  // ── Selection helpers ──
  const toggleRow = (globalIdx) => {
    const next = new Set(selected)
    next.has(globalIdx) ? next.delete(globalIdx) : next.add(globalIdx)
    setSelected(next)
    onSelectionChange?.(sorted.filter((_, i) => next.has(i)))
  }
  const toggleAll = () => {
    const pageIndices = paginated.map((_, i) => (page - 1) * pageSize + i)
    const allSelected = pageIndices.every(i => selected.has(i))
    const next = new Set(selected)
    pageIndices.forEach(i => allSelected ? next.delete(i) : next.add(i))
    setSelected(next)
    onSelectionChange?.(sorted.filter((_, i) => next.has(i)))
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleFilter = (key, value) => {
    setFilters(f => ({ ...f, [key]: value }))
  }

  const cellPad = compact ? '0.35rem 0.5rem' : '0.6rem 0.75rem'
  const headerBg = 'var(--color-surface-secondary, var(--color-bg-secondary))'
  const borderColor = 'var(--color-border)'
  const hoverBg = 'var(--color-surface-hover, rgba(128,128,128,0.08))'
  const stripeBg = 'var(--color-surface-tertiary, rgba(128,128,128,0.04))'

  // Sort indicator
  const sortIcon = (key) => {
    if (sortKey !== key) return ' ↕'
    return sortDir === 'asc' ? ' ↑' : ' ↓'
  }

  // ── Render ──
  const filterableColumns = columns.filter(c => c.filterable)

  return React.createElement('div', {
    className: cn('datagrid', className),
    style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.5rem' }, style),
    ...rest,
  },
    // Toolbar: search + page size
    (searchable || pageSizeOptions.length > 1) && React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
    },
      searchable && React.createElement('input', {
        type: 'text',
        value: search,
        onChange: e => setSearch(e.target.value),
        placeholder: searchPlaceholder,
        className: 'input',
        style: { maxWidth: '16rem', fontSize: compact ? '0.8rem' : undefined },
      }),
      // Column filters
      ...filterableColumns.map(col =>
        React.createElement('input', {
          key: col.key,
          type: 'text',
          value: filters[col.key] || '',
          onChange: e => handleFilter(col.key, e.target.value),
          placeholder: `Filter ${col.label}...`,
          className: 'input',
          style: { maxWidth: '10rem', fontSize: compact ? '0.8rem' : undefined },
        })
      ),
      React.createElement('div', { style: { flex: 1 } }),
      // Row count
      React.createElement('span', {
        style: { fontSize: '0.8rem', color: 'var(--color-text-secondary)' },
      }, `${sorted.length} row${sorted.length !== 1 ? 's' : ''}`),
      // Page size selector
      pageSizeOptions.length > 1 && React.createElement('select', {
        className: 'select',
        value: pageSize,
        onChange: e => { setPageSize(Number(e.target.value)); setPage(1) },
        style: { width: 'auto', fontSize: '0.8rem', padding: '0.25rem 0.5rem' },
      }, ...pageSizeOptions.map(n =>
        React.createElement('option', { key: n, value: n }, `${n} / page`)
      )),
    ),

    // Table wrapper
    React.createElement('div', {
      style: {
        overflowX: 'auto',
        ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
        border: `1px solid ${borderColor}`,
        borderRadius: 'var(--radius-md, 0.5rem)',
      },
    },
      React.createElement('table', {
        style: { width: '100%', borderCollapse: 'collapse', fontSize: compact ? '0.8rem' : '0.875rem' },
        role: 'grid',
      },
        // Header
        React.createElement('thead', null,
          React.createElement('tr', null,
            selectable && React.createElement('th', {
              style: {
                padding: cellPad, background: headerBg, borderBottom: `1px solid ${borderColor}`,
                width: '2.5rem', textAlign: 'center',
                ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 2 } : {}),
              },
            },
              React.createElement('input', {
                type: 'checkbox',
                checked: paginated.length > 0 && paginated.every((_, i) => selected.has((page - 1) * pageSize + i)),
                onChange: toggleAll,
                'aria-label': 'Select all rows on this page',
              })
            ),
            ...columns.map(col =>
              React.createElement('th', {
                key: col.key,
                style: {
                  padding: cellPad, background: headerBg, borderBottom: `1px solid ${borderColor}`,
                  textAlign: col.align || 'left', fontWeight: 600,
                  whiteSpace: 'nowrap', userSelect: 'none',
                  ...(col.width ? { width: col.width } : {}),
                  ...(col.sortable ? { cursor: 'pointer' } : {}),
                  ...(stickyHeader ? { position: 'sticky', top: 0, zIndex: 2 } : {}),
                },
                onClick: col.sortable ? () => handleSort(col.key) : undefined,
                'aria-sort': sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined,
              }, col.label, col.sortable ? sortIcon(col.key) : null)
            ),
          ),
        ),
        // Body
        React.createElement('tbody', null,
          paginated.length === 0
            ? React.createElement('tr', null,
                React.createElement('td', {
                  colSpan: columns.length + (selectable ? 1 : 0),
                  style: { padding: '2rem', textAlign: 'center', color: 'var(--color-text-secondary)' },
                }, emptyText)
              )
            : paginated.map((row, i) => {
                const globalIdx = (page - 1) * pageSize + i
                const isSelected = selected.has(globalIdx)
                return React.createElement('tr', {
                  key: row.id ?? globalIdx,
                  onClick: onRowClick ? () => onRowClick(row, globalIdx) : undefined,
                  style: {
                    cursor: onRowClick ? 'pointer' : undefined,
                    background: isSelected
                      ? 'var(--color-primary-soft, rgba(59,130,246,0.1))'
                      : (striped && i % 2 === 1 ? stripeBg : undefined),
                  },
                  onMouseEnter: e => { if (!isSelected) e.currentTarget.style.background = hoverBg },
                  onMouseLeave: e => {
                    e.currentTarget.style.background = isSelected
                      ? 'var(--color-primary-soft, rgba(59,130,246,0.1))'
                      : (striped && i % 2 === 1 ? stripeBg : 'transparent')
                  },
                },
                  selectable && React.createElement('td', {
                    style: { padding: cellPad, textAlign: 'center', borderBottom: `1px solid ${borderColor}` },
                    onClick: e => e.stopPropagation(),
                  },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: isSelected,
                      onChange: () => toggleRow(globalIdx),
                      'aria-label': `Select row ${globalIdx + 1}`,
                    })
                  ),
                  ...columns.map(col =>
                    React.createElement('td', {
                      key: col.key,
                      style: {
                        padding: cellPad, textAlign: col.align || 'left',
                        borderBottom: `1px solid ${borderColor}`,
                      },
                    }, col.render ? col.render(row[col.key], row, globalIdx) : row[col.key])
                  ),
                )
              }),
        ),
      ),
    ),

    // Pagination footer
    totalPages > 1 && React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: '0.8rem', color: 'var(--color-text-secondary)',
      },
    },
      React.createElement('span', null,
        selectable && selected.size > 0
          ? `${selected.size} selected · Page ${page} of ${totalPages}`
          : `Page ${page} of ${totalPages}`
      ),
      React.createElement('div', { style: { display: 'flex', gap: '0.25rem' } },
        React.createElement('button', {
          className: 'btn btn-ghost btn-sm',
          disabled: page <= 1,
          onClick: () => setPage(1),
          'aria-label': 'First page',
        }, '«'),
        React.createElement('button', {
          className: 'btn btn-ghost btn-sm',
          disabled: page <= 1,
          onClick: () => setPage(p => p - 1),
          'aria-label': 'Previous page',
        }, '‹'),
        React.createElement('button', {
          className: 'btn btn-ghost btn-sm',
          disabled: page >= totalPages,
          onClick: () => setPage(p => p + 1),
          'aria-label': 'Next page',
        }, '›'),
        React.createElement('button', {
          className: 'btn btn-ghost btn-sm',
          disabled: page >= totalPages,
          onClick: () => setPage(totalPages),
          'aria-label': 'Last page',
        }, '»'),
      ),
    ),
  )
}

// ─── Accordion ──────────────────────────────────────────────────────────────

/**
 * Accordion — collapsible content sections.
 *
 * Props:
 *   items: Array<{ id: string, title: string|ReactNode, content: ReactNode, disabled?: boolean }>
 *   multiple?: boolean — allow multiple open (default false)
 *   defaultOpen?: string[] — initially open item ids
 *   className, style
 *
 * Usage:
 *   <Accordion items={[
 *     { id: 'a', title: 'Section 1', content: <p>Content 1</p> },
 *     { id: 'b', title: 'Section 2', content: <p>Content 2</p> },
 *   ]} />
 */
export function Accordion({ items = [], multiple = false, defaultOpen = [], className, style, ...rest }) {
  const [openIds, setOpenIds] = React.useState(new Set(defaultOpen))

  function toggle(id) {
    setOpenIds(prev => {
      const next = new Set(multiple ? prev : [])
      if (prev.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return React.createElement('div', {
    className: ['accordion', className].filter(Boolean).join(' '),
    style: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg, 0.5rem)', overflow: 'hidden', ...style },
    role: 'presentation',
    ...rest,
  },
    items.map((item, i) => {
      const isOpen = openIds.has(item.id)
      const isLast = i === items.length - 1
      return React.createElement('div', { key: item.id },
        // Header
        React.createElement('button', {
          type: 'button',
          role: 'button',
          'aria-expanded': isOpen,
          'aria-controls': `accordion-panel-${item.id}`,
          disabled: item.disabled,
          onClick: () => !item.disabled && toggle(item.id),
          className: 'accordion-trigger',
          style: {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '0.75rem 1rem',
            background: 'transparent', border: 'none',
            borderBottom: (isOpen || !isLast) ? '1px solid var(--color-border)' : 'none',
            color: item.disabled ? 'var(--color-muted-foreground)' : 'var(--color-foreground)',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem', fontWeight: 500, textAlign: 'left',
            transition: 'background 0.15s',
          },
          onMouseEnter: (e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--color-muted)' },
          onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent' },
        },
          React.createElement('span', { style: { flex: 1 } }, item.title),
          React.createElement('span', {
            style: {
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
              fontSize: '0.75rem',
              marginLeft: '0.5rem',
            },
          }, '▼'),
        ),
        // Panel
        React.createElement('div', {
          id: `accordion-panel-${item.id}`,
          role: 'region',
          'aria-labelledby': `accordion-trigger-${item.id}`,
          style: {
            overflow: 'hidden',
            maxHeight: isOpen ? '9999px' : '0',
            transition: 'max-height 0.3s ease',
          },
        },
          React.createElement('div', {
            style: {
              padding: '0.75rem 1rem',
              borderBottom: (!isLast && isOpen) ? '1px solid var(--color-border)' : 'none',
            },
          }, item.content),
        ),
      )
    }),
  )
}

// ─── DropdownMenu ───────────────────────────────────────────────────────────

/**
 * DropdownMenu — click-triggered dropdown with menu items.
 *
 * Props:
 *   trigger: ReactNode — the button/element that opens the menu
 *   items: Array<{ label: string, onClick?: fn, icon?: string|ReactNode, disabled?: boolean, destructive?: boolean, divider?: boolean }>
 *   align?: 'start' | 'end' — horizontal alignment (default 'start')
 *   className, style
 *
 * Usage:
 *   <DropdownMenu
 *     trigger={<Button variant="ghost">⋯</Button>}
 *     items={[
 *       { label: 'Edit', icon: '✏️', onClick: () => {} },
 *       { divider: true },
 *       { label: 'Delete', destructive: true, onClick: () => {} },
 *     ]}
 *   />
 */
export function DropdownMenu({ trigger, items = [], align = 'start', className, style, ...rest }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef(null)

  // Close on outside click or Escape
  React.useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function onClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onClick) }
  }, [open])

  return React.createElement('div', {
    ref,
    className: ['dropdown-menu-container', className].filter(Boolean).join(' '),
    style: { position: 'relative', display: 'inline-block', ...style },
    ...rest,
  },
    // Trigger
    React.createElement('div', {
      onClick: () => setOpen(o => !o),
      style: { cursor: 'pointer' },
    }, trigger),
    // Menu
    open && React.createElement('div', {
      role: 'menu',
      className: 'dropdown-menu',
      style: {
        position: 'absolute', top: '100%', marginTop: '0.25rem',
        [align === 'end' ? 'right' : 'left']: 0,
        minWidth: '10rem',
        background: 'var(--color-popover, var(--color-card))',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg, 0.5rem)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '0.25rem',
        zIndex: 50,
        animation: 'fade-in 0.15s ease',
      },
    },
      items.map((item, i) => {
        if (item.divider) {
          return React.createElement('div', {
            key: `divider-${i}`,
            role: 'separator',
            style: { height: '1px', background: 'var(--color-border)', margin: '0.25rem 0' },
          })
        }
        return React.createElement('button', {
          key: item.label || i,
          type: 'button',
          role: 'menuitem',
          disabled: item.disabled,
          onClick: () => { if (!item.disabled && item.onClick) { item.onClick(); setOpen(false) } },
          style: {
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            width: '100%', padding: '0.5rem 0.75rem',
            background: 'transparent', border: 'none',
            borderRadius: 'var(--radius-md, 0.375rem)',
            color: item.destructive ? 'var(--color-destructive)' : item.disabled ? 'var(--color-muted-foreground)' : 'var(--color-foreground)',
            cursor: item.disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.875rem', textAlign: 'left',
            transition: 'background 0.1s',
          },
          onMouseEnter: (e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--color-muted)' },
          onMouseLeave: (e) => { e.currentTarget.style.background = 'transparent' },
        },
          item.icon && React.createElement('span', { style: { flexShrink: 0, width: '1.25rem', textAlign: 'center' } }, item.icon),
          React.createElement('span', null, item.label),
        )
      }),
    ),
  )
}


// ─── Panel ────────────────────────────────────────────────────────────────────

/**
 * Collapsible panel with title bar, optional icon and actions.
 * @param {{ title: string, icon?: any, collapsible?: boolean, defaultOpen?: boolean, actions?: any, variant?: 'default'|'outlined'|'filled', className?: string, style?: object, children: any }} props
 */
export function Panel({ title, icon, collapsible = false, defaultOpen = true, actions, variant = 'default', className, style, children, ...rest }) {
  const [open, setOpen] = useState(defaultOpen)

  const variantStyles = {
    default: {
      background: 'var(--color-card, var(--color-background))',
      border: '1px solid var(--color-border)',
    },
    outlined: {
      background: 'transparent',
      border: '1px solid var(--color-border)',
    },
    filled: {
      background: 'var(--color-muted, rgba(128,128,128,0.08))',
      border: '1px solid transparent',
    },
  }

  const headerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderBottom: open ? '1px solid var(--color-border)' : 'none',
    cursor: collapsible ? 'pointer' : 'default',
    userSelect: 'none',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--color-foreground)',
  }

  const chevron = collapsible ? React.createElement('span', {
    style: {
      display: 'inline-flex',
      transition: 'transform 0.2s',
      transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
      fontSize: '0.75rem',
      color: 'var(--color-muted-foreground)',
    },
  }, '▶') : null

  return React.createElement('div', {
    className: cn('kb-panel', className),
    style: {
      ...variantStyles[variant] || variantStyles.default,
      borderRadius: 'var(--radius-lg, 0.5rem)',
      overflow: 'hidden',
      ...style,
    },
    ...rest,
  },
    React.createElement('div', {
      style: headerStyle,
      onClick: collapsible ? () => setOpen(o => !o) : undefined,
      role: collapsible ? 'button' : undefined,
      'aria-expanded': collapsible ? open : undefined,
    },
      chevron,
      icon && React.createElement('span', { style: { flexShrink: 0 } }, icon),
      React.createElement('span', { style: { flex: 1 } }, title),
      actions && React.createElement('span', {
        onClick: (e) => e.stopPropagation(),
        style: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
      }, actions),
    ),
    open && React.createElement('div', {
      style: { padding: '1rem' },
    }, children),
  )
}

// ─── RadioGroup ───────────────────────────────────────────────────────────────

/**
 * Radio button group.
 * @param {{ name?: string, options: Array<{ value: string, label: string, disabled?: boolean }>, value?: string, onChange?: (value: string) => void, direction?: 'column'|'row', label?: string, error?: string, className?: string, style?: object }} props
 */
export function RadioGroup({ name, options = [], value, onChange, direction = 'column', label: groupLabel, error, className, style, ...rest }) {
  const autoName = useId()
  const groupName = name || autoName

  const radioStyle = {
    width: '1rem',
    height: '1rem',
    accentColor: 'var(--color-primary, #6366f1)',
    cursor: 'pointer',
    margin: 0,
  }

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: 'var(--color-foreground)',
    cursor: 'pointer',
    padding: '0.25rem 0',
  }

  const disabledLabelStyle = {
    ...labelStyle,
    opacity: 0.5,
    cursor: 'not-allowed',
  }

  return React.createElement('fieldset', {
    className: cn('kb-radio-group', className),
    style: { border: 'none', padding: 0, margin: 0, ...style },
    ...rest,
  },
    groupLabel && React.createElement('legend', {
      style: {
        fontSize: '0.875rem',
        fontWeight: 500,
        color: 'var(--color-foreground)',
        marginBottom: '0.5rem',
        padding: 0,
      },
    }, groupLabel),
    React.createElement('div', {
      style: { display: 'flex', flexDirection: direction, gap: direction === 'row' ? '1rem' : '0.25rem' },
      role: 'radiogroup',
    },
      options.map(opt =>
        React.createElement('label', {
          key: opt.value,
          style: opt.disabled ? disabledLabelStyle : labelStyle,
        },
          React.createElement('input', {
            type: 'radio',
            name: groupName,
            value: opt.value,
            checked: value === opt.value,
            disabled: opt.disabled,
            onChange: () => onChange && onChange(opt.value),
            style: radioStyle,
          }),
          opt.label,
        )
      ),
    ),
    error && React.createElement('p', {
      style: { fontSize: '0.75rem', color: 'var(--color-destructive, #ef4444)', marginTop: '0.375rem' },
    }, error),
  )
}

// ─── Slider ───────────────────────────────────────────────────────────────────

/**
 * Range slider input.
 * @param {{ value?: number, min?: number, max?: number, step?: number, onChange?: (value: number) => void, label?: string, showValue?: boolean, formatValue?: (v: number) => string, disabled?: boolean, className?: string, style?: object }} props
 */
export function Slider({ value = 0, min = 0, max = 100, step = 1, onChange, label, showValue = true, formatValue, disabled, className, style, ...rest }) {
  const display = formatValue ? formatValue(value) : String(value)
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0

  const trackStyle = {
    width: '100%',
    height: '0.375rem',
    borderRadius: '9999px',
    background: `linear-gradient(to right, var(--color-primary, #6366f1) ${pct}%, var(--color-muted, rgba(128,128,128,0.2)) ${pct}%)`,
    appearance: 'none',
    outline: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  }

  return React.createElement('div', {
    className: cn('kb-slider', className),
    style: { display: 'flex', flexDirection: 'column', gap: '0.375rem', ...style },
    ...rest,
  },
    (label || showValue) && React.createElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' },
    },
      label && React.createElement('span', { style: { fontWeight: 500, color: 'var(--color-foreground)' } }, label),
      showValue && React.createElement('span', { style: { color: 'var(--color-muted-foreground)', fontVariantNumeric: 'tabular-nums' } }, display),
    ),
    React.createElement('input', {
      type: 'range',
      min,
      max,
      step,
      value,
      disabled,
      onChange: (e) => onChange && onChange(Number(e.target.value)),
      style: trackStyle,
    }),
  )
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

/**
 * Simple date input with optional label and error.
 * @param {{ value?: string, onChange?: (value: string) => void, label?: string, error?: string, type?: 'date'|'datetime-local'|'time', min?: string, max?: string, disabled?: boolean, className?: string, style?: object }} props
 */
export function DatePicker({ value, onChange, label, error, type = 'date', min, max, disabled, className, id: propId, style, ...rest }) {
  const autoId = useId()
  const id = propId || autoId

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    border: `1px solid ${error ? 'var(--color-destructive, #ef4444)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md, 0.375rem)',
    background: 'var(--color-card, var(--color-background))',
    color: 'var(--color-foreground)',
    outline: 'none',
    transition: 'border-color 0.15s',
    colorScheme: 'inherit',
    opacity: disabled ? 0.5 : 1,
  }

  return React.createElement('div', {
    className: cn('kb-date-picker', className),
    style: { display: 'flex', flexDirection: 'column', gap: '0.375rem', ...style },
  },
    label && React.createElement('label', {
      htmlFor: id,
      style: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-foreground)' },
    }, label),
    React.createElement('input', {
      id,
      type,
      value: value || '',
      min,
      max,
      disabled,
      onChange: (e) => onChange && onChange(e.target.value),
      onFocus: (e) => { e.target.style.borderColor = 'var(--color-ring, var(--color-primary))' },
      onBlur: (e) => { e.target.style.borderColor = error ? 'var(--color-destructive, #ef4444)' : 'var(--color-border)' },
      style: inputStyle,
      ...rest,
    }),
    error && React.createElement('p', {
      style: { fontSize: '0.75rem', color: 'var(--color-destructive, #ef4444)' },
    }, error),
  )
}

// ─── Charts ───────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
]

function getChartColor(i) {
  return CHART_COLORS[i % CHART_COLORS.length]
}

// ─── BarChart ─────────────────────────────────────────────────────────────────

/**
 * BarChart - Vertical bar chart using SVG
 *
 * Props:
 *   data: Array<{ label: string, value: number, color?: string }>
 *   width?: number (default 400)
 *   height?: number (default 250)
 *   showValues?: boolean (default true) — show value labels on bars
 *   showGrid?: boolean (default true) — horizontal grid lines
 *   barRadius?: number (default 4) — border radius on bar tops
 *   gap?: number (default 0.3) — gap ratio between bars (0-1)
 *   animate?: boolean (default true)
 *   className?: string
 *   style?: object
 */
export function BarChart({
  data = [],
  width = 400,
  height = 250,
  showValues = true,
  showGrid = true,
  barRadius = 4,
  gap = 0.3,
  animate = true,
  className,
  style,
}) {
  if (!data.length) return null

  const padding = { top: 20, right: 16, bottom: 40, left: 48 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const maxVal = Math.max(...data.map(d => d.value), 0) || 1
  const niceMax = niceNumber(maxVal)
  const gridLines = 5
  const barWidth = chartW / data.length
  const innerBar = barWidth * (1 - gap)

  return React.createElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width, height,
    className: cn('kb-bar-chart', className),
    style: { maxWidth: '100%', height: 'auto', ...style },
    role: 'img',
    'aria-label': 'Bar chart',
  },
    // grid lines
    showGrid && Array.from({ length: gridLines + 1 }, (_, i) => {
      const y = padding.top + (chartH / gridLines) * i
      const val = niceMax - (niceMax / gridLines) * i
      return React.createElement('g', { key: `g${i}` },
        React.createElement('line', {
          x1: padding.left, y1: y, x2: width - padding.right, y2: y,
          stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: i === gridLines ? 'none' : '4,4',
        }),
        React.createElement('text', {
          x: padding.left - 8, y: y + 4, textAnchor: 'end',
          fill: 'var(--color-muted-foreground)', fontSize: 10,
        }, formatCompact(val)),
      )
    }),
    // bars
    data.map((d, i) => {
      const barH = (d.value / niceMax) * chartH
      const x = padding.left + barWidth * i + (barWidth - innerBar) / 2
      const y = padding.top + chartH - barH
      const color = d.color || getChartColor(i)
      return React.createElement('g', { key: i },
        React.createElement('rect', {
          x, y, width: innerBar, height: barH,
          rx: barRadius, ry: barRadius,
          fill: color,
          style: animate ? { animation: `kb-bar-grow 0.5s ease-out ${i * 0.05}s both`, transformOrigin: `${x + innerBar / 2}px ${padding.top + chartH}px` } : undefined,
        }),
        // value label
        showValues && d.value > 0 && React.createElement('text', {
          x: x + innerBar / 2, y: y - 6, textAnchor: 'middle',
          fill: 'var(--color-foreground)', fontSize: 10, fontWeight: 500,
        }, formatCompact(d.value)),
        // x-axis label
        React.createElement('text', {
          x: x + innerBar / 2, y: height - padding.bottom + 16, textAnchor: 'middle',
          fill: 'var(--color-muted-foreground)', fontSize: 10,
        }, truncLabel(d.label, Math.floor(innerBar / 6))),
      )
    }),
  )
}

// ─── LineChart ────────────────────────────────────────────────────────────────

/**
 * LineChart - Multi-series line chart using SVG
 *
 * Props:
 *   data: Array<{ label: string, values: number[] }> — each entry is an x-axis point
 *         OR Array<{ label: string, value: number }> for single series
 *   series?: string[] — series names (for legend)
 *   width?: number (default 400)
 *   height?: number (default 250)
 *   showDots?: boolean (default true)
 *   showGrid?: boolean (default true)
 *   showArea?: boolean (default false) — fill area under lines
 *   curved?: boolean (default true) — smooth curves
 *   animate?: boolean (default true)
 *   className?: string
 *   style?: object
 */
export function LineChart({
  data = [],
  series,
  width = 400,
  height = 250,
  showDots = true,
  showGrid = true,
  showArea = false,
  curved = true,
  animate = true,
  className,
  style,
}) {
  if (!data.length) return null

  // normalize to multi-series
  const isMulti = Array.isArray(data[0]?.values)
  const seriesCount = isMulti ? (data[0]?.values?.length || 1) : 1
  const getVal = (d, s) => isMulti ? (d.values?.[s] ?? 0) : (d.value ?? 0)

  const padding = { top: 20, right: 16, bottom: 40, left: 48 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  let allVals = []
  data.forEach(d => {
    for (let s = 0; s < seriesCount; s++) allVals.push(getVal(d, s))
  })
  const maxVal = Math.max(...allVals, 0) || 1
  const niceMax = niceNumber(maxVal)
  const gridLines = 5

  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0
  const toX = i => padding.left + xStep * i
  const toY = v => padding.top + chartH - (v / niceMax) * chartH

  const buildPath = (seriesIdx) => {
    const points = data.map((d, i) => [toX(i), toY(getVal(d, seriesIdx))])
    if (curved && points.length > 2) return catmullRomPath(points)
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')
  }

  const pathLength = useRef(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return React.createElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width, height,
    className: cn('kb-line-chart', className),
    style: { maxWidth: '100%', height: 'auto', ...style },
    role: 'img',
    'aria-label': 'Line chart',
  },
    // defs for area gradient
    showArea && React.createElement('defs', null,
      Array.from({ length: seriesCount }, (_, s) =>
        React.createElement('linearGradient', { key: s, id: `area-${s}`, x1: 0, y1: 0, x2: 0, y2: 1 },
          React.createElement('stop', { offset: '0%', stopColor: getChartColor(s), stopOpacity: 0.3 }),
          React.createElement('stop', { offset: '100%', stopColor: getChartColor(s), stopOpacity: 0.02 }),
        )
      )
    ),
    // grid
    showGrid && Array.from({ length: gridLines + 1 }, (_, i) => {
      const y = padding.top + (chartH / gridLines) * i
      const val = niceMax - (niceMax / gridLines) * i
      return React.createElement('g', { key: `g${i}` },
        React.createElement('line', {
          x1: padding.left, y1: y, x2: width - padding.right, y2: y,
          stroke: 'var(--color-border)', strokeWidth: 1, strokeDasharray: i === gridLines ? 'none' : '4,4',
        }),
        React.createElement('text', {
          x: padding.left - 8, y: y + 4, textAnchor: 'end',
          fill: 'var(--color-muted-foreground)', fontSize: 10,
        }, formatCompact(val)),
      )
    }),
    // x labels
    data.map((d, i) => React.createElement('text', {
      key: `x${i}`, x: toX(i), y: height - padding.bottom + 16, textAnchor: 'middle',
      fill: 'var(--color-muted-foreground)', fontSize: 10,
    }, truncLabel(d.label, 8))),
    // series
    Array.from({ length: seriesCount }, (_, s) => {
      const d = buildPath(s)
      const color = getChartColor(s)
      return React.createElement('g', { key: `s${s}` },
        // area
        showArea && React.createElement('path', {
          d: d + ` L${toX(data.length - 1)},${padding.top + chartH} L${toX(0)},${padding.top + chartH} Z`,
          fill: `url(#area-${s})`,
        }),
        // line
        React.createElement('path', {
          d, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
          style: animate && mounted ? { strokeDasharray: 2000, strokeDashoffset: 0, transition: 'stroke-dashoffset 1s ease-out' } : undefined,
        }),
        // dots
        showDots && data.map((pt, i) => React.createElement('circle', {
          key: i, cx: toX(i), cy: toY(getVal(pt, s)), r: 3.5,
          fill: 'var(--color-background)', stroke: color, strokeWidth: 2,
        })),
      )
    }),
    // legend
    series && seriesCount > 1 && React.createElement('g', { transform: `translate(${padding.left}, ${height - 8})` },
      series.map((name, s) => React.createElement('g', { key: s, transform: `translate(${s * 90}, 0)` },
        React.createElement('rect', { width: 10, height: 10, rx: 2, fill: getChartColor(s) }),
        React.createElement('text', { x: 14, y: 9, fill: 'var(--color-muted-foreground)', fontSize: 10 }, name),
      ))
    ),
  )
}

// ─── PieChart ─────────────────────────────────────────────────────────────────

/**
 * PieChart - Pie/donut chart using SVG
 *
 * Props:
 *   data: Array<{ label: string, value: number, color?: string }>
 *   width?: number (default 250)
 *   height?: number (default 250)
 *   donut?: boolean (default false) — ring chart
 *   showLabels?: boolean (default true) — show labels outside
 *   showLegend?: boolean (default true) — show legend below
 *   animate?: boolean (default true)
 *   className?: string
 *   style?: object
 */
export function PieChart({
  data = [],
  width = 250,
  height = 250,
  donut = false,
  showLabels = true,
  showLegend = true,
  animate = true,
  className,
  style,
}) {
  if (!data.length) return null

  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const cx = width / 2
  const cy = (showLegend ? height - 40 : height) / 2
  const r = Math.min(cx, cy) - (showLabels ? 30 : 10)
  const innerR = donut ? r * 0.55 : 0
  const legendY = showLegend ? height - 32 : 0

  let cumAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2
    const startAngle = cumAngle
    cumAngle += angle
    const endAngle = cumAngle
    return { ...d, startAngle, endAngle, angle, color: d.color || getChartColor(i), index: i }
  })

  return React.createElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width, height,
    className: cn('kb-pie-chart', className),
    style: { maxWidth: '100%', height: 'auto', ...style },
    role: 'img',
    'aria-label': 'Pie chart',
  },
    slices.map(s => {
      const path = arcPath(cx, cy, r, innerR, s.startAngle, s.endAngle)
      const midAngle = (s.startAngle + s.endAngle) / 2
      const labelR = r + 16
      const lx = cx + Math.cos(midAngle) * labelR
      const ly = cy + Math.sin(midAngle) * labelR
      const pct = Math.round((s.value / total) * 100)
      return React.createElement('g', { key: s.index },
        React.createElement('path', {
          d: path, fill: s.color,
          stroke: 'var(--color-background)', strokeWidth: 2,
          style: animate ? { animation: `kb-pie-grow 0.6s ease-out ${s.index * 0.08}s both`, transformOrigin: `${cx}px ${cy}px` } : undefined,
        }),
        showLabels && pct >= 5 && React.createElement('text', {
          x: lx, y: ly, textAnchor: Math.cos(midAngle) > 0.1 ? 'start' : Math.cos(midAngle) < -0.1 ? 'end' : 'middle',
          dominantBaseline: 'middle',
          fill: 'var(--color-muted-foreground)', fontSize: 10,
        }, `${pct}%`),
      )
    }),
    // center label for donut
    donut && React.createElement('text', {
      x: cx, y: cy, textAnchor: 'middle', dominantBaseline: 'middle',
      fill: 'var(--color-foreground)', fontSize: 18, fontWeight: 600,
    }, formatCompact(total)),
    // legend
    showLegend && React.createElement('g', { transform: `translate(${8}, ${legendY})` },
      slices.map((s, i) => {
        const col = Math.floor(i / 2)
        const row = i % 2
        return React.createElement('g', { key: i, transform: `translate(${col * 120}, ${row * 16})` },
          React.createElement('rect', { width: 8, height: 8, rx: 2, fill: s.color, y: 1 }),
          React.createElement('text', { x: 12, y: 9, fill: 'var(--color-muted-foreground)', fontSize: 10 },
            truncLabel(s.label, 12)),
        )
      })
    ),
  )
}

// ─── SparkLine ────────────────────────────────────────────────────────────────

/**
 * SparkLine - Tiny inline line chart
 *
 * Props:
 *   data: number[]
 *   width?: number (default 100)
 *   height?: number (default 32)
 *   color?: string
 *   showArea?: boolean (default true)
 *   strokeWidth?: number (default 1.5)
 *   className?: string
 *   style?: object
 */
export function SparkLine({
  data = [],
  width = 100,
  height = 32,
  color = 'var(--color-primary)',
  showArea = true,
  strokeWidth = 1.5,
  className,
  style,
}) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const w = width - pad * 2
  const h = height - pad * 2

  const points = data.map((v, i) => [
    pad + (i / (data.length - 1)) * w,
    pad + h - ((v - min) / range) * h,
  ])

  const pathD = catmullRomPath(points)

  return React.createElement('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width, height,
    className: cn('kb-sparkline', className),
    style: { display: 'inline-block', verticalAlign: 'middle', ...style },
    role: 'img',
    'aria-label': 'Sparkline',
  },
    showArea && React.createElement('defs', null,
      React.createElement('linearGradient', { id: 'spark-area', x1: 0, y1: 0, x2: 0, y2: 1 },
        React.createElement('stop', { offset: '0%', stopColor: color, stopOpacity: 0.2 }),
        React.createElement('stop', { offset: '100%', stopColor: color, stopOpacity: 0 }),
      )
    ),
    showArea && React.createElement('path', {
      d: pathD + ` L${points[points.length - 1][0]},${height - pad} L${points[0][0]},${height - pad} Z`,
      fill: 'url(#spark-area)',
    }),
    React.createElement('path', {
      d: pathD, fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    }),
  )
}

// ─── Chart Helpers ────────────────────────────────────────────────────────────

function niceNumber(val) {
  const exp = Math.floor(Math.log10(val))
  const frac = val / Math.pow(10, exp)
  let nice
  if (frac <= 1) nice = 1
  else if (frac <= 2) nice = 2
  else if (frac <= 5) nice = 5
  else nice = 10
  return nice * Math.pow(10, exp)
}

function formatCompact(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  return String(Math.round(n * 10) / 10)
}

function truncLabel(str, max) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

function catmullRomPath(points, tension = 0.3) {
  if (points.length < 2) return ''
  if (points.length === 2) return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`

  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]
    const cp1x = p1[0] + (p2[0] - p0[0]) * tension
    const cp1y = p1[1] + (p2[1] - p0[1]) * tension
    const cp2x = p2[0] - (p3[0] - p1[0]) * tension
    const cp2y = p2[1] - (p3[1] - p1[1]) * tension
    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`
  }
  return d
}

function arcPath(cx, cy, outerR, innerR, startAngle, endAngle) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0
  const sx = cx + Math.cos(startAngle) * outerR
  const sy = cy + Math.sin(startAngle) * outerR
  const ex = cx + Math.cos(endAngle) * outerR
  const ey = cy + Math.sin(endAngle) * outerR

  if (innerR > 0) {
    const isx = cx + Math.cos(endAngle) * innerR
    const isy = cy + Math.sin(endAngle) * innerR
    const iex = cx + Math.cos(startAngle) * innerR
    const iey = cy + Math.sin(startAngle) * innerR
    return `M${sx},${sy} A${outerR},${outerR} 0 ${largeArc} 1 ${ex},${ey} L${isx},${isy} A${innerR},${innerR} 0 ${largeArc} 0 ${iex},${iey} Z`
  }
  return `M${cx},${cy} L${sx},${sy} A${outerR},${outerR} 0 ${largeArc} 1 ${ex},${ey} Z`
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

/**
 * Multi-step progress indicator with navigation.
 * Renders a horizontal step bar with numbered circles, labels, and connecting lines.
 * Steps can be completed, active, or upcoming.
 *
 * @param {{ steps: Array<{ label: string, description?: string, icon?: string }>, activeStep: number, onStepClick?: (index: number) => void, variant?: 'default'|'compact', allowClickAhead?: boolean, className?: string, style?: object }} props
 *
 * @example
 *   <Stepper steps={[{ label: 'Account' }, { label: 'Profile' }, { label: 'Review' }]} activeStep={1} />
 */
export function Stepper({ steps = [], activeStep = 0, onStepClick, variant = 'default', allowClickAhead = false, className, style, ...rest }) {
  const isCompact = variant === 'compact'

  const handleClick = (index) => {
    if (!onStepClick) return
    if (index <= activeStep || allowClickAhead) onStepClick(index)
  }

  return React.createElement('div', {
    className: cn('kb-stepper', isCompact && 'kb-stepper--compact', className),
    style: mergeStyles({
      display: 'flex',
      alignItems: 'flex-start',
      width: '100%',
      gap: 0,
    }, style),
    role: 'navigation',
    'aria-label': 'Progress steps',
    ...rest,
  }, steps.map((step, i) => {
    const status = i < activeStep ? 'completed' : i === activeStep ? 'active' : 'upcoming'
    const clickable = onStepClick && (i <= activeStep || allowClickAhead)

    return React.createElement(React.Fragment, { key: i }, [
      // Step item
      React.createElement('button', {
        key: 'step-' + i,
        type: 'button',
        className: cn('kb-stepper__step', 'kb-stepper__step--' + status),
        onClick: () => handleClick(i),
        disabled: !clickable,
        'aria-current': status === 'active' ? 'step' : undefined,
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isCompact ? '0.25rem' : '0.5rem',
          flex: '0 0 auto',
          minWidth: isCompact ? 'auto' : '80px',
          background: 'none',
          border: 'none',
          padding: isCompact ? '0.25rem' : '0.25rem 0.5rem',
          cursor: clickable ? 'pointer' : 'default',
          opacity: status === 'upcoming' ? 0.5 : 1,
          transition: 'opacity 0.2s ease',
        },
      }, [
        // Circle indicator
        React.createElement('div', {
          key: 'circle',
          style: {
            width: isCompact ? '28px' : '36px',
            height: isCompact ? '28px' : '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: isCompact ? '0.75rem' : '0.85rem',
            fontWeight: 600,
            transition: 'all 0.3s ease',
            background: status === 'completed'
              ? 'var(--color-primary)'
              : status === 'active'
                ? 'var(--color-primary)'
                : 'var(--color-muted)',
            color: status === 'upcoming'
              ? 'var(--color-muted-foreground)'
              : 'var(--color-primary-foreground, #fff)',
            boxShadow: status === 'active'
              ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 25%, transparent)'
              : 'none',
          },
        }, step.icon
          ? step.icon
          : status === 'completed'
            ? '✓'
            : String(i + 1)
        ),
        // Label
        !isCompact && React.createElement('div', {
          key: 'label',
          style: {
            fontSize: '0.8rem',
            fontWeight: status === 'active' ? 600 : 400,
            color: status === 'upcoming'
              ? 'var(--color-muted-foreground)'
              : 'var(--color-foreground)',
            textAlign: 'center',
            lineHeight: 1.3,
            transition: 'color 0.2s ease',
          },
        }, step.label),
        // Description
        !isCompact && step.description && React.createElement('div', {
          key: 'desc',
          style: {
            fontSize: '0.7rem',
            color: 'var(--color-muted-foreground)',
            textAlign: 'center',
            lineHeight: 1.3,
            marginTop: '-0.25rem',
          },
        }, step.description),
      ]),
      // Connector line (not after last step)
      i < steps.length - 1 && React.createElement('div', {
        key: 'line-' + i,
        style: {
          flex: 1,
          height: '2px',
          minWidth: '24px',
          alignSelf: 'center',
          marginTop: isCompact ? '0' : '-' + (step.description ? '1.5rem' : '0.75rem'),
          background: i < activeStep
            ? 'var(--color-primary)'
            : 'var(--color-border)',
          borderRadius: '1px',
          transition: 'background 0.3s ease',
        },
      }),
    ])
  }))
}

// ─── StepperContent ───────────────────────────────────────────────────────────

/**
 * Companion to Stepper. Renders only the child matching the active step index.
 * Children should be step content elements; only the one at `activeStep` is shown.
 *
 * @param {{ activeStep: number, children: any, animated?: boolean, className?: string, style?: object }} props
 *
 * @example
 *   <StepperContent activeStep={step}>
 *     <div>Step 1 content</div>
 *     <div>Step 2 content</div>
 *   </StepperContent>
 */
export function StepperContent({ activeStep = 0, children, animated = true, className, style, ...rest }) {
  const items = React.Children.toArray(children)
  const content = items[activeStep] || null
  return React.createElement('div', {
    className: cn(animated && 'animate-fade-in', className),
    key: activeStep,
    style,
    ...rest,
  }, content)
}

// ─── FileUpload ───────────────────────────────────────────────────────────────

/**
 * Drag-and-drop file upload zone with click-to-browse fallback.
 *
 * @param {{ accept?: string, multiple?: boolean, maxSize?: number, maxFiles?: number, onFiles?: (files: File[]) => void, onError?: (error: string) => void, disabled?: boolean, label?: string, hint?: string, icon?: string, compact?: boolean, className?: string, style?: object }} props
 *
 * @example
 *   <FileUpload accept="image/*" maxSize={5 * 1024 * 1024} onFiles={files => console.log(files)} />
 */
export function FileUpload({
  accept,
  multiple = false,
  maxSize,
  maxFiles = 10,
  onFiles,
  onError,
  disabled = false,
  label,
  hint,
  icon = '📁',
  compact = false,
  className,
  style,
  ...rest
}) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  function validate(files) {
    const arr = Array.from(files)
    if (!multiple && arr.length > 1) {
      onError?.('Only one file allowed')
      return null
    }
    if (arr.length > maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`)
      return null
    }
    if (maxSize) {
      const tooBig = arr.find(f => f.size > maxSize)
      if (tooBig) {
        const mb = (maxSize / (1024 * 1024)).toFixed(1)
        onError?.(`File "${tooBig.name}" exceeds ${mb} MB limit`)
        return null
      }
    }
    if (accept) {
      const patterns = accept.split(',').map(s => s.trim())
      const invalid = arr.find(f => !patterns.some(p => {
        if (p.startsWith('.')) return f.name.toLowerCase().endsWith(p.toLowerCase())
        if (p.endsWith('/*')) return f.type.startsWith(p.slice(0, -1))
        return f.type === p
      }))
      if (invalid) {
        onError?.(`File type "${invalid.type || invalid.name}" is not accepted`)
        return null
      }
    }
    return arr
  }

  function handleFiles(files) {
    const valid = validate(files)
    if (valid && valid.length > 0) onFiles?.(valid)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }, [disabled, accept, multiple, maxSize, maxFiles])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setDragOver(true)
  }, [disabled])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const baseStyle = {
    border: '2px dashed var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: compact ? '12px 16px' : '32px 16px',
    textAlign: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
    backgroundColor: dragOver ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
    borderColor: dragOver ? 'var(--color-primary)' : 'var(--color-border)',
    opacity: disabled ? 0.5 : 1,
  }

  return React.createElement('div', {
    className: cn('kb-file-upload', className),
    style: mergeStyles(baseStyle, style),
    onDrop: handleDrop,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onClick: () => !disabled && inputRef.current?.click(),
    role: 'button',
    tabIndex: disabled ? -1 : 0,
    'aria-label': label || 'Upload files',
    'aria-disabled': disabled,
    onKeyDown: (e) => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); inputRef.current?.click() } },
    ...rest,
  },
    React.createElement('input', {
      ref: inputRef,
      type: 'file',
      accept,
      multiple,
      disabled,
      style: { display: 'none' },
      onChange: (e) => { handleFiles(e.target.files); e.target.value = '' },
    }),
    !compact && React.createElement('div', { style: { fontSize: '2rem', marginBottom: '8px' } }, icon),
    React.createElement('div', {
      style: { fontWeight: 500, color: 'var(--color-foreground)', fontSize: compact ? '0.875rem' : undefined },
    }, label || (dragOver ? 'Drop files here' : 'Drop files here or click to browse')),
    hint && React.createElement('div', {
      style: { fontSize: '0.75rem', color: 'var(--color-muted-foreground)', marginTop: '4px' },
    }, hint),
  )
}

// ─── CodeBlock ────────────────────────────────────────────────────────────────

/**
 * Formatted code display with optional copy button and language label.
 * No external syntax highlighter needed; uses monospace styling with the theme.
 *
 * @param {{ code: string, language?: string, showCopy?: boolean, showLineNumbers?: boolean, maxHeight?: string, className?: string, style?: object }} props
 *
 * @example
 *   <CodeBlock code={`const x = 42;`} language="javascript" showCopy />
 */
export function CodeBlock({
  code = '',
  language,
  showCopy = true,
  showLineNumbers = false,
  maxHeight = '400px',
  className,
  style,
  ...rest
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const lines = code.split('\n')

  const containerStyle = {
    position: 'relative',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-muted)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
  }

  const preStyle = {
    margin: 0,
    padding: '16px',
    paddingRight: showCopy ? '48px' : '16px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: '0.8125rem',
    lineHeight: 1.6,
    overflowX: 'auto',
    overflowY: 'auto',
    maxHeight,
    color: 'var(--color-foreground)',
    tabSize: 2,
  }

  const lineNumStyle = {
    display: 'inline-block',
    width: `${String(lines.length).length + 1}ch`,
    textAlign: 'right',
    paddingRight: '12px',
    marginRight: '12px',
    borderRight: '1px solid var(--color-border)',
    color: 'var(--color-muted-foreground)',
    userSelect: 'none',
  }

  return React.createElement('div', {
    className: cn('kb-code-block', className),
    style: mergeStyles(containerStyle, style),
    ...rest,
  },
    (language || showCopy) && React.createElement('div', {
      style: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        borderBottom: '1px solid var(--color-border)',
        fontSize: '0.75rem',
        color: 'var(--color-muted-foreground)',
      },
    },
      React.createElement('span', null, language || ''),
      showCopy && React.createElement('button', {
        onClick: handleCopy,
        style: {
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: copied ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
          fontSize: '0.75rem',
          padding: '2px 6px',
          borderRadius: 'var(--radius-sm)',
          transition: 'color 0.2s',
        },
        'aria-label': 'Copy code',
      }, copied ? '✓ Copied' : 'Copy'),
    ),
    React.createElement('pre', { style: preStyle },
      React.createElement('code', null,
        showLineNumbers
          ? lines.map((line, i) => React.createElement('div', { key: i, style: { display: 'flex' } },
              React.createElement('span', { style: lineNumStyle }, i + 1),
              React.createElement('span', { style: { flex: 1 } }, line),
            ))
          : code,
      ),
    ),
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

/**
 * Vertical timeline for displaying chronological events.
 *
 * @param {{ items: Array<{ title: string, description?: string, time?: string, icon?: string, color?: string }>, className?: string, style?: object }} props
 *
 * @example
 *   <Timeline items={[
 *     { title: 'Order placed', time: '10:30 AM', icon: '📦' },
 *     { title: 'Payment confirmed', time: '10:31 AM', icon: '✅', color: 'var(--color-primary)' },
 *   ]} />
 */
export function Timeline({ items = [], className, style, ...rest }) {
  return React.createElement('div', {
    className: cn('kb-timeline', className),
    style: mergeStyles({ position: 'relative', paddingLeft: '28px' }, style),
    role: 'list',
    ...rest,
  },
    // Vertical line
    React.createElement('div', {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        left: '9px',
        top: '4px',
        bottom: '4px',
        width: '2px',
        backgroundColor: 'var(--color-border)',
        borderRadius: '1px',
      },
    }),
    items.map((item, i) =>
      React.createElement('div', {
        key: i,
        role: 'listitem',
        style: {
          position: 'relative',
          paddingBottom: i < items.length - 1 ? '24px' : '0',
        },
      },
        // Dot / icon
        React.createElement('div', {
          'aria-hidden': true,
          style: {
            position: 'absolute',
            left: '-28px',
            top: '2px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: item.color || 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: item.icon ? '0.7rem' : '0',
            color: 'white',
            border: '2px solid var(--color-background)',
          },
        }, item.icon || null),
        // Content
        React.createElement('div', null,
          React.createElement('div', {
            style: { display: 'flex', alignItems: 'baseline', gap: '8px' },
          },
            React.createElement('span', {
              style: { fontWeight: 600, color: 'var(--color-foreground)', fontSize: '0.875rem' },
            }, item.title),
            item.time && React.createElement('span', {
              style: { fontSize: '0.75rem', color: 'var(--color-muted-foreground)' },
            }, item.time),
          ),
          item.description && React.createElement('div', {
            style: { marginTop: '4px', fontSize: '0.8125rem', color: 'var(--color-muted-foreground)', lineHeight: 1.5 },
          }, item.description),
        ),
      ),
    ),
  )
}

// ─── AvatarGroup ──────────────────────────────────────────────────────────────

/**
 * Stacked group of avatars with overflow indicator.
 *
 * @param {{ avatars: Array<{ src?: string, name?: string }>, max?: number, size?: 'sm'|'md'|'lg', className?: string, style?: object }} props
 *
 * @example
 *   <AvatarGroup avatars={[{ name: 'Alice' }, { name: 'Bob' }, { src: '/img.jpg' }]} max={3} />
 */
export function AvatarGroup({ avatars = [], max = 5, size = 'md', className, style, ...rest }) {
  const sizes = { sm: 28, md: 36, lg: 44 }
  const px = sizes[size] || sizes.md
  const shown = avatars.slice(0, max)
  const overflow = avatars.length - max

  return React.createElement('div', {
    className: cn('kb-avatar-group', className),
    style: mergeStyles({ display: 'flex', alignItems: 'center' }, style),
    role: 'group',
    'aria-label': `${avatars.length} members`,
    ...rest,
  },
    shown.map((av, i) => {
      const initials = (av.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
      return React.createElement('div', {
        key: i,
        title: av.name,
        style: {
          width: px,
          height: px,
          borderRadius: '50%',
          border: '2px solid var(--color-background)',
          marginLeft: i > 0 ? `${-px * 0.3}px` : '0',
          position: 'relative',
          zIndex: shown.length - i,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: av.src ? 'transparent' : 'var(--color-primary)',
          color: 'white',
          fontSize: `${px * 0.38}px`,
          fontWeight: 600,
          flexShrink: 0,
        },
      },
        av.src
          ? React.createElement('img', { src: av.src, alt: av.name || '', style: { width: '100%', height: '100%', objectFit: 'cover' } })
          : initials,
      )
    }),
    overflow > 0 && React.createElement('div', {
      style: {
        width: px,
        height: px,
        borderRadius: '50%',
        border: '2px solid var(--color-background)',
        marginLeft: `${-px * 0.3}px`,
        position: 'relative',
        zIndex: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--color-muted)',
        color: 'var(--color-muted-foreground)',
        fontSize: `${px * 0.34}px`,
        fontWeight: 600,
        flexShrink: 0,
      },
    }, `+${overflow}`),
  )
}

// ─── NumberInput ───────────────────────────────────────────────────────────────

/**
 * Numeric input with increment/decrement buttons.
 *
 * @param {{ value?: number, onChange?: (value: number) => void, min?: number, max?: number, step?: number, label?: string, error?: string, disabled?: boolean, size?: 'sm'|'md'|'lg', className?: string, style?: object }} props
 *
 * @example
 *   const [qty, setQty] = useState(1)
 *   <NumberInput value={qty} onChange={setQty} min={0} max={99} label="Quantity" />
 */
export function NumberInput({
  value = 0,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  label,
  error,
  disabled = false,
  size = 'md',
  className,
  style,
  ...rest
}) {
  const id = useId()
  const sizes = { sm: { h: 32, font: '0.8125rem', btnW: 28 }, md: { h: 38, font: '0.875rem', btnW: 32 }, lg: { h: 44, font: '1rem', btnW: 36 } }
  const s = sizes[size] || sizes.md

  function clamp(v) {
    return Math.min(max, Math.max(min, v))
  }

  function increment() {
    if (!disabled) onChange?.(clamp(value + step))
  }

  function decrement() {
    if (!disabled) onChange?.(clamp(value - step))
  }

  function handleInput(e) {
    const raw = e.target.value
    if (raw === '' || raw === '-') return
    const n = parseFloat(raw)
    if (!isNaN(n)) onChange?.(clamp(n))
  }

  const btnStyle = {
    width: s.btnW,
    height: s.h,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? 'var(--color-muted-foreground)' : 'var(--color-foreground)',
    fontSize: '1.1rem',
    fontWeight: 600,
    padding: 0,
    opacity: disabled ? 0.5 : 1,
    flexShrink: 0,
  }

  return React.createElement('div', {
    className: cn('kb-number-input', className),
    style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '4px' }, style),
    ...rest,
  },
    label && React.createElement('label', {
      htmlFor: id,
      style: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-foreground)' },
    }, label),
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${error ? 'var(--color-destructive)' : 'var(--color-border)'}`,
        backgroundColor: 'var(--color-background)',
        overflow: 'hidden',
        opacity: disabled ? 0.6 : 1,
      },
    },
      React.createElement('button', {
        type: 'button',
        onClick: decrement,
        disabled: disabled || value <= min,
        style: { ...btnStyle, borderRight: '1px solid var(--color-border)' },
        'aria-label': 'Decrease',
        tabIndex: -1,
      }, '−'),
      React.createElement('input', {
        id,
        type: 'text',
        inputMode: 'numeric',
        value: String(value),
        onChange: handleInput,
        disabled,
        style: {
          flex: 1,
          height: s.h,
          textAlign: 'center',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          color: 'var(--color-foreground)',
          fontSize: s.font,
          fontWeight: 500,
          minWidth: 0,
        },
        'aria-label': label || 'Number input',
      }),
      React.createElement('button', {
        type: 'button',
        onClick: increment,
        disabled: disabled || value >= max,
        style: { ...btnStyle, borderLeft: '1px solid var(--color-border)' },
        'aria-label': 'Increase',
        tabIndex: -1,
      }, '+'),
    ),
    error && React.createElement('span', {
      style: { fontSize: '0.75rem', color: 'var(--color-destructive)' },
      role: 'alert',
    }, error),
  )
}

// ─── Combobox ─────────────────────────────────────────────────────────────────

/**
 * Searchable select dropdown with filtering, keyboard navigation, and optional custom rendering.
 *
 * @param {{
 *   options: Array<{ value: string, label: string, disabled?: boolean, icon?: string, description?: string }>,
 *   value?: string,
 *   onChange?: (value: string, option: object) => void,
 *   placeholder?: string,
 *   searchPlaceholder?: string,
 *   label?: string,
 *   error?: string,
 *   disabled?: boolean,
 *   clearable?: boolean,
 *   emptyText?: string,
 *   maxHeight?: string,
 *   renderOption?: (option: object, isActive: boolean) => ReactNode,
 *   className?: string,
 *   style?: object,
 * }} props
 *
 * @example
 *   <Combobox
 *     label="Country"
 *     options={[{ value: 'fr', label: 'France' }, { value: 'us', label: 'United States' }]}
 *     value={country}
 *     onChange={setCountry}
 *     placeholder="Select a country..."
 *   />
 */
export function Combobox({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  label,
  error,
  disabled = false,
  clearable = false,
  emptyText = 'No results found',
  maxHeight = '240px',
  renderOption,
  className,
  style,
  ...rest
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const id = useId()

  const selectedOption = options.find(o => o.value === value)

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return
    function onClickOut(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
      }
    }
    function onEsc(e) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onClickOut)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onClickOut)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  // Reset active index on filter change
  useEffect(() => {
    setActiveIndex(filtered.length > 0 ? 0 : -1)
  }, [query, filtered.length])

  // Focus search input when opening
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // Scroll active item into view
  useEffect(() => {
    if (!open || activeIndex < 0 || !listRef.current) return
    const items = listRef.current.children
    if (items[activeIndex]) {
      items[activeIndex].scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex, open])

  function handleSelect(option) {
    if (option.disabled) return
    onChange?.(option.value, option)
    setOpen(false)
    setQuery('')
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }

    const enabledItems = filtered.filter(o => !o.disabled)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(i => {
          let next = i + 1
          while (next < filtered.length && filtered[next]?.disabled) next++
          return next < filtered.length ? next : i
        })
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(i => {
          let next = i - 1
          while (next >= 0 && filtered[next]?.disabled) next--
          return next >= 0 ? next : i
        })
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && filtered[activeIndex] && !filtered[activeIndex].disabled) {
          handleSelect(filtered[activeIndex])
        }
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(filtered.length - 1)
        break
    }
  }

  function handleClear(e) {
    e.stopPropagation()
    onChange?.('', null)
    setQuery('')
  }

  const triggerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    minHeight: '38px',
    padding: '0.5rem 0.75rem',
    border: `1px solid ${error ? 'var(--color-destructive)' : open ? 'var(--color-ring, var(--color-primary))' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-foreground)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    textAlign: 'left',
    outline: 'none',
    opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.15s',
  }

  const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    zIndex: 50,
    backgroundColor: 'var(--color-popover, var(--color-card))',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    animation: 'fade-in 0.15s ease',
    overflow: 'hidden',
  }

  const optionStyle = (isActive, isDisabled) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    background: isActive ? 'var(--color-muted)' : 'transparent',
    border: 'none',
    color: isDisabled ? 'var(--color-muted-foreground)' : 'var(--color-foreground)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    fontSize: '0.875rem',
    textAlign: 'left',
    opacity: isDisabled ? 0.5 : 1,
    transition: 'background 0.1s',
  })

  return React.createElement('div', {
    className: cn('kb-combobox', className),
    style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.375rem' }, style),
    ...rest,
  },
    label && React.createElement('label', {
      htmlFor: `combobox-${id}`,
      style: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-foreground)' },
    }, label),
    React.createElement('div', {
      ref: containerRef,
      style: { position: 'relative' },
    },
      // Trigger button
      React.createElement('button', {
        id: `combobox-${id}`,
        type: 'button',
        role: 'combobox',
        'aria-expanded': open,
        'aria-haspopup': 'listbox',
        'aria-controls': `combobox-list-${id}`,
        disabled,
        onClick: () => !disabled && setOpen(o => !o),
        onKeyDown: handleKeyDown,
        style: triggerStyle,
      },
        selectedOption?.icon && React.createElement('span', { style: { flexShrink: 0 } }, selectedOption.icon),
        React.createElement('span', {
          style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: selectedOption ? 'inherit' : 'var(--color-muted-foreground)' },
        }, selectedOption ? selectedOption.label : placeholder),
        clearable && value && React.createElement('span', {
          onClick: handleClear,
          role: 'button',
          'aria-label': 'Clear selection',
          style: { cursor: 'pointer', color: 'var(--color-muted-foreground)', fontSize: '1rem', lineHeight: 1, padding: '0 2px' },
        }, '\u00d7'),
        React.createElement('span', {
          style: {
            flexShrink: 0,
            fontSize: '0.6rem',
            color: 'var(--color-muted-foreground)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          },
        }, '▼'),
      ),
      // Dropdown
      open && React.createElement('div', { style: dropdownStyle },
        // Search input
        React.createElement('div', {
          style: { padding: '0.5rem', borderBottom: '1px solid var(--color-border)' },
        },
          React.createElement('input', {
            ref: inputRef,
            type: 'text',
            value: query,
            onChange: e => setQuery(e.target.value),
            onKeyDown: handleKeyDown,
            placeholder: searchPlaceholder,
            className: 'input',
            style: { fontSize: '0.8125rem' },
            role: 'searchbox',
            'aria-label': 'Search options',
            'aria-autocomplete': 'list',
            'aria-controls': `combobox-list-${id}`,
          }),
        ),
        // Options list
        React.createElement('div', {
          ref: listRef,
          id: `combobox-list-${id}`,
          role: 'listbox',
          'aria-label': label || 'Options',
          style: { maxHeight, overflowY: 'auto', padding: '0.25rem' },
        },
          filtered.length === 0
            ? React.createElement('div', {
                style: { padding: '0.75rem', textAlign: 'center', color: 'var(--color-muted-foreground)', fontSize: '0.8125rem' },
              }, emptyText)
            : filtered.map((opt, i) => {
                const isActive = i === activeIndex
                const isSelected = opt.value === value
                return React.createElement('button', {
                  key: opt.value,
                  type: 'button',
                  role: 'option',
                  'aria-selected': isSelected,
                  'aria-disabled': opt.disabled,
                  disabled: opt.disabled,
                  onClick: () => handleSelect(opt),
                  onMouseEnter: () => setActiveIndex(i),
                  style: {
                    ...optionStyle(isActive, opt.disabled),
                    borderRadius: 'var(--radius-md)',
                  },
                },
                  renderOption
                    ? renderOption(opt, isActive)
                    : [
                        opt.icon && React.createElement('span', { key: 'icon', style: { flexShrink: 0 } }, opt.icon),
                        React.createElement('div', { key: 'content', style: { flex: 1, minWidth: 0 } },
                          React.createElement('div', {
                            style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                          }, opt.label),
                          opt.description && React.createElement('div', {
                            style: { fontSize: '0.75rem', color: 'var(--color-muted-foreground)', marginTop: '1px' },
                          }, opt.description),
                        ),
                        isSelected && React.createElement('span', {
                          key: 'check',
                          style: { flexShrink: 0, color: 'var(--color-primary)', fontSize: '0.875rem' },
                        }, '✓'),
                      ],
                )
              }),
        ),
      ),
    ),
    error && React.createElement('p', {
      style: { color: 'var(--color-destructive)', fontSize: '0.8125rem', margin: 0 },
    }, error),
  )
}

// ─── TagInput ─────────────────────────────────────────────────────────────────

/**
 * Multi-tag input with keyboard support (Enter to add, Backspace to remove last).
 * Supports suggestions dropdown, validation, and max tag limits.
 *
 * @param {{
 *   value?: string[],
 *   onChange?: (tags: string[]) => void,
 *   suggestions?: string[],
 *   placeholder?: string,
 *   label?: string,
 *   error?: string,
 *   disabled?: boolean,
 *   maxTags?: number,
 *   allowDuplicates?: boolean,
 *   validate?: (tag: string) => string|null,
 *   variant?: 'default'|'primary',
 *   size?: 'sm'|'md',
 *   className?: string,
 *   style?: object,
 * }} props
 *
 * @example
 *   const [tags, setTags] = useState(['react', 'typescript'])
 *   <TagInput
 *     label="Skills"
 *     value={tags}
 *     onChange={setTags}
 *     suggestions={['react', 'vue', 'svelte', 'angular']}
 *     placeholder="Add a skill..."
 *     maxTags={10}
 *   />
 */
export function TagInput({
  value = [],
  onChange,
  suggestions = [],
  placeholder = 'Type and press Enter...',
  label,
  error,
  disabled = false,
  maxTags = Infinity,
  allowDuplicates = false,
  validate,
  variant = 'default',
  size = 'md',
  className,
  style,
  ...rest
}) {
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [localError, setLocalError] = useState(null)
  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const id = useId()

  const isSmall = size === 'sm'

  // Filter suggestions
  const filteredSuggestions = input.trim()
    ? suggestions.filter(s =>
        s.toLowerCase().includes(input.toLowerCase()) &&
        (allowDuplicates || !value.includes(s))
      )
    : []

  const canAdd = value.length < maxTags && !disabled

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [showSuggestions])

  // Reset suggestion index when filtered list changes
  useEffect(() => {
    setActiveIndex(filteredSuggestions.length > 0 ? 0 : -1)
  }, [input, filteredSuggestions.length])

  function addTag(tag) {
    const trimmed = tag.trim()
    if (!trimmed || !canAdd) return false
    if (!allowDuplicates && value.includes(trimmed)) {
      setLocalError('Already added')
      setTimeout(() => setLocalError(null), 2000)
      return false
    }
    if (validate) {
      const err = validate(trimmed)
      if (err) {
        setLocalError(err)
        setTimeout(() => setLocalError(null), 2000)
        return false
      }
    }
    onChange?.([...value, trimmed])
    setInput('')
    setShowSuggestions(false)
    setLocalError(null)
    return true
  }

  function removeTag(index) {
    if (disabled) return
    const next = [...value]
    next.splice(index, 1)
    onChange?.(next)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && filteredSuggestions[activeIndex]) {
        addTag(filteredSuggestions[activeIndex])
      } else {
        addTag(input)
      }
    } else if (e.key === 'Backspace' && input === '' && value.length > 0) {
      removeTag(value.length - 1)
    } else if (e.key === ',' || e.key === 'Tab') {
      if (input.trim()) {
        e.preventDefault()
        addTag(input)
      }
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, filteredSuggestions.length - 1))
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  function handleInputChange(e) {
    setInput(e.target.value)
    setShowSuggestions(true)
    setLocalError(null)
  }

  const displayError = error || localError

  const tagPad = isSmall ? '0.125rem 0.375rem' : '0.1875rem 0.5rem'
  const tagFont = isSmall ? '0.75rem' : '0.8125rem'

  const containerStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: isSmall ? '0.25rem' : '0.375rem',
    minHeight: isSmall ? '32px' : '38px',
    padding: isSmall ? '0.25rem 0.5rem' : '0.375rem 0.5rem',
    border: `1px solid ${displayError ? 'var(--color-destructive)' : 'var(--color-border)'}`,
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--color-background)',
    cursor: disabled ? 'not-allowed' : 'text',
    opacity: disabled ? 0.5 : 1,
    transition: 'border-color 0.15s',
  }

  const tagStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: tagPad,
    borderRadius: 'var(--radius-md)',
    fontSize: tagFont,
    fontWeight: 500,
    backgroundColor: variant === 'primary'
      ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
      : 'var(--color-muted)',
    color: variant === 'primary'
      ? 'var(--color-primary)'
      : 'var(--color-foreground)',
    lineHeight: 1.4,
    maxWidth: '100%',
    animation: 'fade-in 0.15s ease',
  }

  const removeButtonStyle = {
    background: 'none',
    border: 'none',
    padding: '0 1px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: 'inherit',
    opacity: 0.6,
    fontSize: tagFont,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
  }

  return React.createElement('div', {
    className: cn('kb-tag-input', className),
    style: mergeStyles({ display: 'flex', flexDirection: 'column', gap: '0.375rem' }, style),
    ...rest,
  },
    label && React.createElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    },
      React.createElement('label', {
        htmlFor: `taginput-${id}`,
        style: { fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-foreground)' },
      }, label),
      maxTags < Infinity && React.createElement('span', {
        style: { fontSize: '0.75rem', color: value.length >= maxTags ? 'var(--color-destructive)' : 'var(--color-muted-foreground)' },
      }, `${value.length}/${maxTags}`),
    ),
    React.createElement('div', { ref: containerRef, style: { position: 'relative' } },
      // Tags + input container
      React.createElement('div', {
        style: containerStyle,
        onClick: () => !disabled && inputRef.current?.focus(),
        onFocus: (e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--color-ring, var(--color-primary))' },
        onBlur: (e) => {
          if (!containerRef.current?.contains(e.relatedTarget)) {
            e.currentTarget.style.borderColor = displayError ? 'var(--color-destructive)' : 'var(--color-border)'
          }
        },
      },
        // Tags
        ...value.map((tag, i) =>
          React.createElement('span', {
            key: `${tag}-${i}`,
            style: tagStyle,
          },
            React.createElement('span', {
              style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
            }, tag),
            !disabled && React.createElement('button', {
              type: 'button',
              onClick: (e) => { e.stopPropagation(); removeTag(i) },
              style: removeButtonStyle,
              'aria-label': `Remove ${tag}`,
              tabIndex: -1,
            }, '\u00d7'),
          ),
        ),
        // Text input
        canAdd && React.createElement('input', {
          ref: inputRef,
          id: `taginput-${id}`,
          type: 'text',
          value: input,
          onChange: handleInputChange,
          onKeyDown: handleKeyDown,
          onFocus: () => input.trim() && setShowSuggestions(true),
          placeholder: value.length === 0 ? placeholder : '',
          disabled,
          style: {
            flex: 1,
            minWidth: '60px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: 'var(--color-foreground)',
            fontSize: isSmall ? '0.8125rem' : '0.875rem',
            padding: '2px 0',
          },
          'aria-label': label || 'Add tag',
          role: 'combobox',
          'aria-expanded': showSuggestions && filteredSuggestions.length > 0,
          'aria-autocomplete': 'list',
        }),
      ),
      // Suggestions dropdown
      showSuggestions && filteredSuggestions.length > 0 && React.createElement('div', {
        role: 'listbox',
        style: {
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          zIndex: 50,
          backgroundColor: 'var(--color-popover, var(--color-card))',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '160px',
          overflowY: 'auto',
          padding: '0.25rem',
          animation: 'fade-in 0.15s ease',
        },
      },
        filteredSuggestions.map((s, i) =>
          React.createElement('button', {
            key: s,
            type: 'button',
            role: 'option',
            'aria-selected': i === activeIndex,
            onClick: () => addTag(s),
            onMouseEnter: () => setActiveIndex(i),
            style: {
              display: 'block',
              width: '100%',
              padding: '0.4rem 0.75rem',
              background: i === activeIndex ? 'var(--color-muted)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-foreground)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              textAlign: 'left',
              transition: 'background 0.1s',
            },
          }, s),
        ),
      ),
    ),
    displayError && React.createElement('p', {
      style: { color: 'var(--color-destructive)', fontSize: '0.8125rem', margin: 0 },
      role: 'alert',
    }, displayError),
  )
}

// ─── Routing ────────────────────────────────────────────────────────────────────
// Hash-based router for mini-apps (no server config needed).
// Usage:
//   const { path, navigate, params } = useHashRouter()
//   <Router> <Route path="/" element={<Home/>}/> <Route path="/edit/:id" element={<Edit/>}/> </Router>
//   <Link to="/settings">Settings</Link>

const RouterContext = React.createContext({ path: '/', params: {}, query: {}, navigate: () => {} })

function parsePath(hash) {
  const raw = (hash || '#/').slice(1) || '/'
  const [pathname, search] = raw.split('?')
  const query = {}
  if (search) {
    search.split('&').forEach(p => {
      const [k, v] = p.split('=')
      if (k) query[decodeURIComponent(k)] = v ? decodeURIComponent(v) : ''
    })
  }
  return { pathname: pathname || '/', query }
}

function matchRoute(pattern, pathname) {
  if (pattern === '*') return { matched: true, params: {} }
  const patParts = pattern.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  if (patParts.length !== pathParts.length) return { matched: false }
  const params = {}
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) {
      params[patParts[i].slice(1)] = decodeURIComponent(pathParts[i])
    } else if (patParts[i] !== pathParts[i]) {
      return { matched: false }
    }
  }
  return { matched: true, params }
}

/**
 * useHashRouter — hook for hash-based routing state.
 * Returns { path, params, query, navigate }.
 * `navigate(path, { replace? })` updates location.hash.
 */
export function useHashRouter() {
  return React.useContext(RouterContext)
}

/**
 * Router — provider component. Wrap your app in <Router>...</Router>.
 * Children should be <Route> elements.
 */
export function Router({ children, className, style }) {
  const [loc, setLoc] = React.useState(() => parsePath(location.hash))

  React.useEffect(() => {
    const handler = () => setLoc(parsePath(location.hash))
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  const navigate = React.useCallback((to, opts) => {
    if (opts?.replace) {
      history.replaceState(null, '', '#' + to)
    } else {
      location.hash = to
    }
  }, [])

  // Find matching route among children
  const routes = React.Children.toArray(children).filter(c => c?.type === Route)
  let matchedElement = null
  let matchedParams = {}

  for (const route of routes) {
    const result = matchRoute(route.props.path, loc.pathname)
    if (result.matched) {
      matchedParams = result.params
      matchedElement = route.props.element || route.props.children || null
      break
    }
  }

  const ctx = React.useMemo(() => ({
    path: loc.pathname,
    params: matchedParams,
    query: loc.query,
    navigate,
  }), [loc.pathname, loc.query, matchedParams, navigate])

  return React.createElement(RouterContext.Provider, { value: ctx },
    React.createElement('div', { className, style }, matchedElement)
  )
}

/**
 * Route — declares a route. Must be a direct child of <Router>.
 * Props: path (pattern with :params), element (React element to render).
 * Example: <Route path="/users/:id" element={<UserDetail/>} />
 */
export function Route() {
  return null // Rendered by Router, not directly
}

/**
 * Link — navigation link using hash routing.
 * Props: to (path string), replace (boolean), className, style, children.
 */
export function Link({ to, replace, className, style, children, ...rest }) {
  const { navigate } = React.useContext(RouterContext)
  return React.createElement('a', {
    href: '#' + to,
    className,
    style: { color: 'var(--color-primary)', textDecoration: 'none', cursor: 'pointer', ...style },
    onClick: (e) => {
      e.preventDefault()
      navigate(to, { replace })
      rest.onClick?.(e)
    },
    ...rest,
  }, children)
}

/**
 * Navigate — component that navigates on mount (redirect).
 * Props: to (path string), replace (boolean, default true).
 */
export function Navigate({ to, replace = true }) {
  const { navigate } = React.useContext(RouterContext)
  React.useEffect(() => { navigate(to, { replace }) }, [to, replace, navigate])
  return null
}

/**
 * NavLink — like Link but adds 'active' class when current path matches.
 * Props: to, exact (default false), activeClassName, activeStyle, + Link props.
 */
export function NavLink({ to, exact, activeClassName = 'active', activeStyle, className, style, children, ...rest }) {
  const { path } = React.useContext(RouterContext)
  const isActive = exact ? path === to : path.startsWith(to)
  return React.createElement(Link, {
    to,
    className: [className, isActive ? activeClassName : ''].filter(Boolean).join(' '),
    style: isActive ? { ...style, ...activeStyle } : style,
    'aria-current': isActive ? 'page' : undefined,
    ...rest,
  }, children)
}

// ── Color utilities ──────────────────────────────────────────────────
function hexToHsv(hex) {
  hex = hex.replace('#', '')
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
  const r = parseInt(hex.slice(0,2),16)/255
  const g = parseInt(hex.slice(2,4),16)/255
  const b = parseInt(hex.slice(4,6),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g-b)/d + (g<b?6:0))/6
    else if (max === g) h = ((b-r)/d + 2)/6
    else h = ((r-g)/d + 4)/6
  }
  return { h: h*360, s: max ? d/max : 0, v: max }
}

function hsvToHex(h, s, v) {
  h = ((h % 360) + 360) % 360
  const c = v * s, x = c * (1 - Math.abs((h/60)%2 - 1)), m = v - c
  let r, g, b
  if (h < 60)       { r=c; g=x; b=0 }
  else if (h < 120) { r=x; g=c; b=0 }
  else if (h < 180) { r=0; g=c; b=x }
  else if (h < 240) { r=0; g=x; b=c }
  else if (h < 300) { r=x; g=0; b=c }
  else              { r=c; g=0; b=x }
  const toHex = n => Math.round((n+m)*255).toString(16).padStart(2,'0')
  return '#' + toHex(r) + toHex(g) + toHex(b)
}

/**
 * ColorPicker — a full color picker with saturation/brightness area, hue slider, and hex input.
 * Props: value (hex string), onChange(hex), label, error, swatches (array of hex), disabled, showAlpha, size ('sm'|'md'|'lg')
 */
export function ColorPicker({ value = '#3b82f6', onChange, label, error, swatches, disabled, size = 'md', className, style, ...rest }) {
  const hsv = React.useMemo(() => hexToHsv(value), [value])
  const [dragging, setDragging] = React.useState(null) // 'area' | 'hue'
  const areaRef = React.useRef(null)
  const hueRef = React.useRef(null)
  const [hexInput, setHexInput] = React.useState(value)

  React.useEffect(() => { setHexInput(value) }, [value])

  const emit = React.useCallback((h, s, v) => {
    if (disabled || !onChange) return
    onChange(hsvToHex(h, s, v))
  }, [disabled, onChange])

  const handleAreaPointer = React.useCallback((e) => {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return
    const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const v = Math.max(0, Math.min(1, 1 - (e.clientY - rect.top) / rect.height))
    emit(hsv.h, s, v)
  }, [hsv.h, emit])

  const handleHuePointer = React.useCallback((e) => {
    const rect = hueRef.current?.getBoundingClientRect()
    if (!rect) return
    const h = Math.max(0, Math.min(360, (e.clientX - rect.left) / rect.width * 360))
    emit(h, hsv.s, hsv.v)
  }, [hsv.s, hsv.v, emit])

  React.useEffect(() => {
    if (!dragging) return
    const handler = dragging === 'area' ? handleAreaPointer : handleHuePointer
    const onMove = (e) => { e.preventDefault(); handler(e) }
    const onUp = () => setDragging(null)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp) }
  }, [dragging, handleAreaPointer, handleHuePointer])

  const handleHexChange = (e) => {
    const v = e.target.value
    setHexInput(v)
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      onChange?.(v.toLowerCase())
    }
  }

  const sizes = { sm: { area: 160, hue: 12 }, md: { area: 200, hue: 14 }, lg: { area: 260, hue: 16 } }
  const sz = sizes[size] || sizes.md

  const id = React.useId?.() || ''

  return React.createElement('div', {
    className: ['kb-color-picker', disabled && 'kb-disabled', className].filter(Boolean).join(' '),
    style, ...rest,
  },
    label && React.createElement('label', { className: 'kb-color-picker-label', htmlFor: id + 'hex' }, label),
    // Saturation/brightness area
    React.createElement('div', {
      ref: areaRef,
      className: 'kb-color-picker-area',
      style: {
        width: sz.area, height: sz.area,
        background: `hsl(${hsv.h}, 100%, 50%)`,
        position: 'relative', borderRadius: 'var(--radius-md, 8px)', cursor: disabled ? 'default' : 'crosshair',
        overflow: 'hidden', touchAction: 'none',
      },
      onPointerDown: (e) => { if (disabled) return; setDragging('area'); handleAreaPointer(e) },
    },
      React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to right, #fff, transparent)' } }),
      React.createElement('div', { style: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, #000, transparent)' } }),
      React.createElement('div', {
        className: 'kb-color-picker-thumb',
        style: {
          position: 'absolute',
          left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`,
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 0 2px rgba(0,0,0,0.6)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: value,
        },
      }),
    ),
    // Hue bar
    React.createElement('div', {
      ref: hueRef,
      className: 'kb-color-picker-hue',
      style: {
        width: sz.area, height: sz.hue, marginTop: 8,
        borderRadius: sz.hue / 2, cursor: disabled ? 'default' : 'pointer',
        background: 'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
        position: 'relative', touchAction: 'none',
      },
      onPointerDown: (e) => { if (disabled) return; setDragging('hue'); handleHuePointer(e) },
    },
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: `${(hsv.h / 360) * 100}%`, top: '50%',
          width: sz.hue + 2, height: sz.hue + 2, borderRadius: '50%',
          border: '2px solid #fff', boxShadow: '0 0 2px rgba(0,0,0,0.6)',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
          background: `hsl(${hsv.h}, 100%, 50%)`,
        },
      }),
    ),
    // Hex input + preview
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, width: sz.area },
    },
      React.createElement('div', {
        className: 'kb-color-picker-preview',
        style: {
          width: 32, height: 32, borderRadius: 'var(--radius-sm, 6px)',
          background: value, border: '1px solid var(--color-border, #ddd)', flexShrink: 0,
        },
      }),
      React.createElement('input', {
        id: id + 'hex',
        type: 'text',
        value: hexInput,
        onChange: handleHexChange,
        onBlur: () => setHexInput(value),
        disabled,
        maxLength: 7,
        className: 'kb-input',
        style: { flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' },
        'aria-label': 'Hex color value',
      }),
    ),
    // Swatches
    swatches?.length > 0 && React.createElement('div', {
      className: 'kb-color-picker-swatches',
      style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, width: sz.area },
    },
      ...swatches.map((sw) =>
        React.createElement('button', {
          key: sw,
          type: 'button',
          disabled,
          onClick: () => onChange?.(sw),
          title: sw,
          className: 'kb-color-picker-swatch',
          style: {
            width: 22, height: 22, borderRadius: 'var(--radius-sm, 4px)',
            background: sw, border: sw === value ? '2px solid var(--color-primary, #3b82f6)' : '1px solid var(--color-border, #ddd)',
            cursor: disabled ? 'default' : 'pointer', padding: 0,
          },
          'aria-label': `Select color ${sw}`,
        }),
      ),
    ),
    // Error
    error && React.createElement('div', {
      className: 'kb-field-error',
      style: { marginTop: 4, color: 'var(--color-error, #ef4444)', fontSize: '0.8rem' },
    }, error),
  )
}

// ── MarkdownEditor ──────────────────────────────────────────────────────────

const MD_TOOLBAR = [
  { key: 'bold', icon: 'B', title: 'Bold (Ctrl+B)', wrap: ['**', '**'], shortcut: 'b' },
  { key: 'italic', icon: 'I', title: 'Italic (Ctrl+I)', wrap: ['*', '*'], shortcut: 'i' },
  { key: 'strikethrough', icon: 'S̶', title: 'Strikethrough', wrap: ['~~', '~~'] },
  { key: 'sep1', sep: true },
  { key: 'h1', icon: 'H1', title: 'Heading 1', prefix: '# ' },
  { key: 'h2', icon: 'H2', title: 'Heading 2', prefix: '## ' },
  { key: 'h3', icon: 'H3', title: 'Heading 3', prefix: '### ' },
  { key: 'sep2', sep: true },
  { key: 'ul', icon: '•', title: 'Bullet list', prefix: '- ' },
  { key: 'ol', icon: '1.', title: 'Numbered list', prefix: '1. ' },
  { key: 'task', icon: '☑', title: 'Task list', prefix: '- [ ] ' },
  { key: 'sep3', sep: true },
  { key: 'code', icon: '`', title: 'Inline code (Ctrl+E)', wrap: ['`', '`'], shortcut: 'e' },
  { key: 'codeblock', icon: '```', title: 'Code block', wrap: ['```\n', '\n```'] },
  { key: 'quote', icon: '❝', title: 'Blockquote', prefix: '> ' },
  { key: 'sep4', sep: true },
  { key: 'link', icon: '🔗', title: 'Link (Ctrl+K)', template: '[text](url)', shortcut: 'k' },
  { key: 'image', icon: '🖼', title: 'Image', template: '![alt](url)' },
  { key: 'hr', icon: '—', title: 'Horizontal rule', insert: '\n---\n' },
]

function applyMarkdown(textarea, action) {
  const { selectionStart: s, selectionEnd: e, value } = textarea
  const selected = value.slice(s, e)
  let replacement, cursorPos

  if (action.wrap) {
    const [before, after] = action.wrap
    replacement = before + (selected || 'text') + after
    cursorPos = selected ? s + replacement.length : s + before.length
  } else if (action.prefix) {
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    replacement = null // special: insert prefix at line start
    const before = value.slice(0, lineStart) + action.prefix + value.slice(lineStart)
    textarea.value = before
    textarea.selectionStart = textarea.selectionEnd = s + action.prefix.length
    return before
  } else if (action.template) {
    replacement = action.template
    cursorPos = s + replacement.length
  } else if (action.insert) {
    replacement = action.insert
    cursorPos = s + replacement.length
  }

  if (replacement != null) {
    const result = value.slice(0, s) + replacement + value.slice(e)
    textarea.value = result
    textarea.selectionStart = textarea.selectionEnd = cursorPos
    return result
  }
  return value
}

// Simple markdown→HTML renderer (basic subset, no dependencies)
function renderMarkdown(md) {
  if (!md) return ''
  let html = md
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Code blocks (before other processing)
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre style="background:var(--color-surface-secondary,#f3f4f6);padding:12px;border-radius:var(--radius-sm,6px);overflow-x:auto;font-size:0.85rem"><code>${code.trim()}</code></pre>`)
    // Headings
    .replace(/^### (.+)$/gm, '<h3 style="margin:0.8em 0 0.3em;font-size:1.1rem">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:0.8em 0 0.3em;font-size:1.25rem">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:0.8em 0 0.3em;font-size:1.5rem">$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--color-border,#e5e7eb);margin:1em 0">')
    // Bold, italic, strikethrough, inline code
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--color-surface-secondary,#f3f4f6);padding:2px 5px;border-radius:3px;font-size:0.9em">$1</code>')
    // Images and links
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:var(--radius-sm,6px)">')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--color-primary,#3b82f6)">$1</a>')
    // Task lists
    .replace(/^- \[x\] (.+)$/gm, '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><input type="checkbox" checked disabled>$1</div>')
    .replace(/^- \[ \] (.+)$/gm, '<div style="display:flex;gap:6px;align-items:center;padding:2px 0"><input type="checkbox" disabled>$1</div>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li style="margin-left:1.2em;list-style:disc">$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1.2em;list-style:decimal">$1</li>')
    // Blockquotes
    .replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid var(--color-primary,#3b82f6);margin:0.5em 0;padding:4px 12px;color:var(--color-text-secondary,#6b7280)">$1</blockquote>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '<br><br>')
    // Single newlines
    .replace(/\n/g, '<br>')
  return html
}

export function MarkdownEditor({
  value = '',
  onChange,
  label,
  error,
  placeholder = 'Write markdown...',
  minHeight = 200,
  maxHeight = 600,
  showPreview = true,
  showToolbar = true,
  disabled = false,
  className = '',
  style,
  ...rest
}) {
  const { useState, useRef, useCallback, useId } = React
  const [mode, setMode] = useState('write') // 'write' | 'preview' | 'split'
  const textareaRef = useRef(null)
  const id = useId()

  const handleToolbar = useCallback((action) => {
    const ta = textareaRef.current
    if (!ta || disabled) return
    const newVal = applyMarkdown(ta, action)
    onChange?.(newVal)
    ta.focus()
  }, [onChange, disabled])

  const handleKeyDown = useCallback((e) => {
    if (!e.ctrlKey && !e.metaKey) return
    const action = MD_TOOLBAR.find(a => a.shortcut === e.key)
    if (action) {
      e.preventDefault()
      handleToolbar(action)
    }
  }, [handleToolbar])

  const borderColor = error ? 'var(--color-error, #ef4444)' : 'var(--color-border, #e0e0e0)'

  const containerStyle = {
    border: `1px solid ${borderColor}`,
    borderRadius: 'var(--radius-md, 8px)',
    overflow: 'hidden',
    background: 'var(--color-surface, #fff)',
    ...style,
  }

  const toolbarStyle = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 2,
    padding: '6px 8px',
    borderBottom: '1px solid var(--color-border, #e0e0e0)',
    background: 'var(--color-surface-secondary, #f9fafb)',
    alignItems: 'center',
  }

  const toolBtnStyle = (isActive) => ({
    padding: '3px 7px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    background: isActive ? 'var(--color-primary, #3b82f6)' : 'transparent',
    color: isActive ? '#fff' : 'var(--color-text-secondary, #6b7280)',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: '0.8rem',
    fontWeight: 600,
    lineHeight: 1.4,
    minWidth: 28,
    textAlign: 'center',
    opacity: disabled ? 0.5 : 1,
  })

  const modeBtnStyle = (active) => ({
    padding: '3px 10px',
    border: 'none',
    borderRadius: 'var(--radius-sm, 4px)',
    background: active ? 'var(--color-primary, #3b82f6)' : 'transparent',
    color: active ? '#fff' : 'var(--color-text-secondary, #6b7280)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
  })

  const showWrite = mode === 'write' || mode === 'split'
  const showPrev = mode === 'preview' || mode === 'split'

  return React.createElement('div', { className: `kb-markdown-editor ${className}`, ...rest },
    // Label
    label && React.createElement('label', {
      htmlFor: id,
      style: { display: 'block', marginBottom: 6, fontWeight: 500, fontSize: '0.875rem', color: 'var(--color-text, #1f2937)' },
    }, label),
    // Container
    React.createElement('div', { style: containerStyle },
      // Toolbar
      showToolbar && React.createElement('div', { style: toolbarStyle },
        // Format buttons
        ...MD_TOOLBAR.map(action => {
          if (action.sep) return React.createElement('div', {
            key: action.key,
            style: { width: 1, height: 18, background: 'var(--color-border, #ddd)', margin: '0 4px' },
          })
          return React.createElement('button', {
            key: action.key,
            type: 'button',
            title: action.title,
            disabled,
            onClick: () => handleToolbar(action),
            style: toolBtnStyle(false),
            onMouseEnter: (e) => { if (!disabled) e.target.style.background = 'var(--color-surface-hover, #e5e7eb)' },
            onMouseLeave: (e) => { e.target.style.background = 'transparent' },
          }, action.icon)
        }),
        // Spacer
        React.createElement('div', { style: { flex: 1 } }),
        // Mode toggles
        showPreview && React.createElement('div', { style: { display: 'flex', gap: 2, marginLeft: 8 } },
          React.createElement('button', { type: 'button', onClick: () => setMode('write'), style: modeBtnStyle(mode === 'write') }, 'Write'),
          React.createElement('button', { type: 'button', onClick: () => setMode('split'), style: modeBtnStyle(mode === 'split') }, 'Split'),
          React.createElement('button', { type: 'button', onClick: () => setMode('preview'), style: modeBtnStyle(mode === 'preview') }, 'Preview'),
        ),
      ),
      // Editor area
      React.createElement('div', {
        style: {
          display: 'flex',
          minHeight,
          maxHeight,
        },
      },
        // Textarea
        showWrite && React.createElement('textarea', {
          ref: textareaRef,
          id,
          value,
          onChange: (e) => onChange?.(e.target.value),
          onKeyDown: handleKeyDown,
          placeholder,
          disabled,
          style: {
            flex: 1,
            border: 'none',
            outline: 'none',
            resize: 'vertical',
            padding: 12,
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--color-text, #1f2937)',
            background: 'transparent',
            minHeight,
            maxHeight,
            overflowY: 'auto',
          },
        }),
        // Divider in split mode
        mode === 'split' && React.createElement('div', {
          style: { width: 1, background: 'var(--color-border, #e0e0e0)', flexShrink: 0 },
        }),
        // Preview
        showPrev && React.createElement('div', {
          style: {
            flex: 1,
            padding: 12,
            overflowY: 'auto',
            fontSize: '0.875rem',
            lineHeight: 1.6,
            color: 'var(--color-text, #1f2937)',
            minHeight,
            maxHeight,
            ...(mode === 'preview' ? {} : { borderLeft: 'none' }),
          },
          dangerouslySetInnerHTML: { __html: renderMarkdown(value) || `<span style="color:var(--color-text-tertiary,#9ca3af)">Nothing to preview</span>` },
        }),
      ),
    ),
    // Word/char count
    React.createElement('div', {
      style: { display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 4, fontSize: '0.75rem', color: 'var(--color-text-tertiary, #9ca3af)' },
    },
      React.createElement('span', null, `${value.length} chars`),
      React.createElement('span', null, `${value.trim() ? value.trim().split(/\s+/).length : 0} words`),
    ),
    // Error
    error && React.createElement('div', {
      className: 'kb-field-error',
      style: { marginTop: 4, color: 'var(--color-error, #ef4444)', fontSize: '0.8rem' },
    }, error),
  )
}
