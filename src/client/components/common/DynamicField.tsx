import { Input } from '@/client/components/ui/input'
import { PasswordInput } from '@/client/components/ui/password-input'
import { Label } from '@/client/components/ui/label'
import { Switch } from '@/client/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import type { ChannelConfigField } from '@/shared/types'

interface DynamicFieldProps {
  field: ChannelConfigField
  value: unknown
  onChange: (value: unknown) => void
}

function normalizeOptions(options: ChannelConfigField['options']): { value: string; label: string }[] {
  if (!options) return []
  return options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  )
}

/**
 * Renders one field from a {@link ChannelConfigField} declaration.
 *
 * Used by channel-creation forms to surface adapter/plugin-specific config
 * without hardcoding each field per platform. The field types map to:
 *   - `text`     → Input
 *   - `password` → PasswordInput
 *   - `number`   → Input[type=number]
 *   - `select`   → Select (string options or value/label pairs)
 *   - `switch`   → Switch
 */
export function DynamicField({ field, value, onChange }: DynamicFieldProps) {
  const required = !!field.required
  const labelId = `field-${field.name}`

  const renderInput = () => {
    switch (field.type) {
      case 'password':
        return (
          <PasswordInput
            id={labelId}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={required}
          />
        )

      case 'number':
        return (
          <Input
            id={labelId}
            type="number"
            value={typeof value === 'number' ? value : value === undefined || value === null ? '' : String(value)}
            min={field.min}
            max={field.max}
            placeholder={field.placeholder}
            required={required}
            onChange={(e) => {
              const raw = e.target.value
              if (raw === '') {
                onChange(undefined)
                return
              }
              const num = Number(raw)
              onChange(Number.isFinite(num) ? num : raw)
            }}
          />
        )

      case 'switch': {
        const checked = typeof value === 'boolean' ? value : !!field.default
        return (
          <Switch
            id={labelId}
            checked={checked}
            onCheckedChange={(v) => onChange(v)}
          />
        )
      }

      case 'select': {
        const options = normalizeOptions(field.options)
        const current = typeof value === 'string' ? value : ''
        return (
          <Select value={current} onValueChange={onChange}>
            <SelectTrigger id={labelId} className="w-full">
              <SelectValue placeholder={field.placeholder ?? 'Select…'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      }

      case 'text':
      default:
        return (
          <Input
            id={labelId}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            required={required}
          />
        )
    }
  }

  if (field.type === 'switch') {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Label htmlFor={labelId} className="font-normal">
            {field.label}
            {required && <span className="ml-1 text-destructive">*</span>}
          </Label>
          {field.description && (
            <p className="text-xs text-muted-foreground">{field.description}</p>
          )}
        </div>
        <div className="pt-0.5">{renderInput()}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={labelId}>
        {field.label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {renderInput()}
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}
