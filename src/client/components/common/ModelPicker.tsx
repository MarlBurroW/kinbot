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
import { ProviderIcon } from '@/client/components/common/ProviderIcon'

interface ModelPickerModel {
  id: string
  name: string
  providerId: string
  providerName: string
  providerType: string
  capability: string
}

interface ModelPickerProps {
  models: ModelPickerModel[]
  value: string
  onValueChange: (modelId: string, providerId: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Show a "None" option at the top to clear the selection */
  allowClear?: boolean
}

/** Build the composite value used for matching: `providerId:modelId` */
export function modelPickerValue(modelId: string, providerId: string): string {
  if (!modelId) return ''
  return `${providerId}:${modelId}`
}

export function ModelPicker({
  models,
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  allowClear = false,
}: ModelPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [providerFilter, setProviderFilter] = useState<string | null>(null)

  const getItemValue = (m: ModelPickerModel) => `${m.providerId}:${m.id}`

  const selectedModel = models.find((m) => getItemValue(m) === value)

  /** Unique providers by providerId, preserving insertion order */
  const providers = useMemo(() => {
    const seen = new Map<string, { providerName: string; providerType: string }>()
    for (const m of models) {
      if (!seen.has(m.providerId)) {
        seen.set(m.providerId, { providerName: m.providerName, providerType: m.providerType })
      }
    }
    return seen
  }, [models])

  const filteredModels = useMemo(
    () => (providerFilter ? models.filter((m) => m.providerId === providerFilter) : models),
    [models, providerFilter],
  )

  const modelsByProvider = useMemo(
    () =>
      filteredModels.reduce<Record<string, ModelPickerModel[]>>((acc, m) => {
        if (!acc[m.providerId]) acc[m.providerId] = []
        acc[m.providerId]!.push(m)
        return acc
      }, {}),
    [filteredModels],
  )

  const showFilters = providers.size > 1

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
              {[...providers.entries()].map(([pid, { providerName, providerType }]) => (
                <button
                  key={pid}
                  type="button"
                  onClick={() => setProviderFilter(providerFilter === pid ? null : pid)}
                  className={cn(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors',
                    providerFilter === pid
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <ProviderIcon providerType={providerType} className="size-3" />
                  {providerName}
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
                    onValueChange('', '')
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
            {Object.entries(modelsByProvider).map(([providerId, providerModels]) => {
              const providerInfo = providers.get(providerId)
              return (
                <CommandGroup
                  key={providerId}
                  heading={
                    <span className="flex items-center gap-1.5">
                      <ProviderIcon providerType={providerInfo?.providerType ?? ''} className="size-3.5" />
                      {providerInfo?.providerName ?? providerId}
                    </span>
                  }
                >
                  {providerModels.map((m) => {
                    const itemValue = getItemValue(m)
                    return (
                      <CommandItem
                        key={itemValue}
                        value={`${m.name} ${m.providerName}`}
                        onSelect={() => {
                          onValueChange(m.id, m.providerId)
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
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
