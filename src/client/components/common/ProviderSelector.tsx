import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'

export interface ProviderOption {
  /** Unique identifier for this provider instance */
  id: string
  /** Provider type (e.g. 'openai', 'anthropic') — used for the icon */
  type: string
  /** Display name */
  name: string
}

interface ProviderSelectorProps {
  /** Currently selected provider id (or the noneValue if none selected) */
  value: string
  /** Callback when selection changes */
  onValueChange: (value: string) => void
  /** List of providers to choose from */
  providers: ProviderOption[]
  /** Label for the "none/auto/default" option at the top. If omitted, no none option is shown. */
  noneLabel?: string
  /** Value used for the "none" option (default: "__auto__") */
  noneValue?: string
  /** Custom className for the trigger */
  triggerClassName?: string
  /** Whether the selector is disabled */
  disabled?: boolean
}

export function ProviderSelector({
  value,
  onValueChange,
  providers,
  noneLabel,
  noneValue = '__auto__',
  triggerClassName,
  disabled,
}: ProviderSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && (
          <SelectItem value={noneValue}>{noneLabel}</SelectItem>
        )}
        {providers.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className="flex items-center gap-2">
              <ProviderIcon providerType={p.type} className="size-4" />
              {p.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
