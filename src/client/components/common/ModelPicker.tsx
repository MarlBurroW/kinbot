import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/client/lib/utils'
import { Button } from '@/client/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/client/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/client/components/ui/command'
import { PROVIDER_DISPLAY_NAMES } from '@/shared/constants'
import { ProviderIcon } from '@/client/components/common/ProviderIcon'

interface ModelPickerModel {
  id: string
  name: string
  providerId: string
  providerType: string
  capability: string
}

interface ModelPickerProps {
  models: ModelPickerModel[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  /** 'modelId' = m.id (default), 'providerAndModel' = `${m.providerId}:${m.id}` */
  valueFormat?: 'modelId' | 'providerAndModel'
  disabled?: boolean
  className?: string
  /** Show a "None" option at the top to clear the selection */
  allowClear?: boolean
}

export function ModelPicker({
  models,
  value,
  onValueChange,
  placeholder,
  valueFormat = 'modelId',
  disabled = false,
  className,
  allowClear = false,
}: ModelPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [providerFilter, setProviderFilter] = useState<string | null>(null)

  const getItemValue = (m: ModelPickerModel) =>
    valueFormat === 'providerAndModel' ? `${m.providerId}:${m.id}` : m.id

  const selectedModel = models.find((m) => getItemValue(m) === value)

  const providerTypes = useMemo(
    () => [...new Set(models.map((m) => m.providerType))],
    [models],
  )

  const filteredModels = useMemo(
    () => (providerFilter ? models.filter((m) => m.providerType === providerFilter) : models),
    [models, providerFilter],
  )

  const modelsByProvider = useMemo(
    () =>
      filteredModels.reduce<Record<string, ModelPickerModel[]>>((acc, m) => {
        if (!acc[m.providerType]) acc[m.providerType] = []
        acc[m.providerType].push(m)
        return acc
      }, {}),
    [filteredModels],
  )

  const showFilters = providerTypes.length > 1

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setProviderFilter(null)
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          {selectedModel ? (
            <span className="flex items-center gap-2 truncate">
              <ProviderIcon
                providerType={selectedModel.providerType}
                className="size-4 shrink-0"
              />
              <span className="truncate">{selectedModel.name}</span>
            </span>
          ) : (
            <span>{placeholder ?? t('modelPicker.placeholder')}</span>
          )}
          <ChevronsUpDown className="ml-auto size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('modelPicker.search')} />

          {/* Provider filter tabs */}
          {showFilters && (
            <div className="flex gap-1 border-b px-2 py-1.5">
              <button
                type="button"
                onClick={() => setProviderFilter(null)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                  providerFilter === null
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {t('modelPicker.all')}
              </button>
              {providerTypes.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() => setProviderFilter(providerFilter === pt ? null : pt)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                    providerFilter === pt
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <ProviderIcon providerType={pt} className="size-3" />
                  {PROVIDER_DISPLAY_NAMES[pt] ?? pt}
                </button>
              ))}
            </div>
          )}

          {/* onWheel stopPropagation prevents parent Dialog from stealing scroll */}
          <CommandList
            className="max-h-[300px] overflow-y-auto overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>{t('modelPicker.noResults')}</CommandEmpty>
            {allowClear && (
              <CommandGroup>
                <CommandItem
                  value="__clear__"
                  onSelect={() => {
                    onValueChange('')
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      !value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="text-muted-foreground">—</span>
                </CommandItem>
              </CommandGroup>
            )}
            {Object.entries(modelsByProvider).map(([providerType, providerModels]) => (
              <CommandGroup
                key={providerType}
                heading={
                  <span className="flex items-center gap-1.5">
                    <ProviderIcon providerType={providerType} className="size-3.5" />
                    {PROVIDER_DISPLAY_NAMES[providerType] ?? providerType}
                  </span>
                }
              >
                {providerModels.map((m) => {
                  const itemValue = getItemValue(m)
                  return (
                    <CommandItem
                      key={itemValue}
                      value={`${m.name} ${providerType}`}
                      onSelect={() => {
                        onValueChange(itemValue)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'size-4 shrink-0',
                          value === itemValue ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      {m.name}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
