import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import { KinSelectItem, type KinOption } from '@/client/components/common/KinSelectItem'

interface KinSelectorProps {
  /** Currently selected kin id */
  value: string
  /** Callback when selection changes */
  onValueChange: (value: string) => void
  /** List of kins to choose from */
  kins: KinOption[]
  /** Placeholder text when nothing is selected */
  placeholder?: string
  /** Whether the field is required */
  required?: boolean
  /** Optional "none" option label — if set, adds a none/empty option at the top */
  noneLabel?: string
  /** Custom className for the trigger */
  triggerClassName?: string
  /** If true, the trigger auto-sizes height for the avatar row */
  autoHeight?: boolean
}

export function KinSelector({
  value,
  onValueChange,
  kins,
  placeholder = '',
  required,
  noneLabel,
  triggerClassName,
  autoHeight = true,
}: KinSelectorProps) {
  const selectedKin = kins.find((k) => k.id === value)
  const isNone = !value || value === 'none'

  return (
    <Select value={value} onValueChange={onValueChange} required={required}>
      <SelectTrigger className={triggerClassName ?? (autoHeight ? 'w-full h-auto min-h-9' : undefined)}>
        {!isNone && selectedKin ? (
          <KinSelectItem kin={selectedKin} />
        ) : (
          <SelectValue placeholder={placeholder} />
        )}
      </SelectTrigger>
      <SelectContent position="popper">
        {noneLabel != null && <SelectItem value="none">{noneLabel}</SelectItem>}
        {kins.map((kin) => (
          <SelectItem key={kin.id} value={kin.id} className="py-2">
            <KinSelectItem kin={kin} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
