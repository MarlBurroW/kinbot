import { useState } from 'react'
import { Check, Infinity, Server, Zap, Calculator } from 'lucide-react'

const FREE_FEATURES = [
  'Unlimited Kins (agents)',
  'Unlimited conversations',
  'Unlimited users',
  'All 23+ providers supported',
  'All 6 channel integrations',
  'Long-term memory & compacting',
  'Multi-agent collaboration',
  'MCP tool servers',
  'Encrypted vault',
  'Cron jobs & webhooks',
  'Full source code (AGPL-3.0)',
  'Community support',
]

type UsageLevel = 'light' | 'moderate' | 'heavy'

interface CostEstimate {
  label: string
  messagesPerDay: string
  providers: { name: string; cost: string; note: string }[]
}

const usageLevels: Record<UsageLevel, CostEstimate> = {
  light: {
    label: 'Light',
    messagesPerDay: '~20 messages/day',
    providers: [
      { name: 'Ollama (local)', cost: '$0', note: 'Free forever. Run Llama, Qwen, Mistral, etc. locally.' },
      { name: 'Claude Sonnet 4', cost: '~$3', note: 'Per month. ~600 messages × avg. 2K tokens.' },
      { name: 'Gemini 2.5 Flash', cost: '~$0.50', note: 'Per month. Very cost-effective.' },
      { name: 'DeepSeek V3', cost: '~$0.40', note: 'Per month. Frontier quality at budget prices.' },
    ],
  },
  moderate: {
    label: 'Moderate',
    messagesPerDay: '~100 messages/day',
    providers: [
      { name: 'Ollama (local)', cost: '$0', note: 'Still free. Just need decent hardware.' },
      { name: 'Claude Sonnet 4', cost: '~$15', note: 'Per month. ~3K messages × avg. 2K tokens.' },
      { name: 'GPT-4o', cost: '~$18', note: 'Per month. Still cheaper than a ChatGPT Team seat.' },
      { name: 'Gemini 2.5 Flash', cost: '~$2.50', note: 'Per month. Great for high-volume use.' },
    ],
  },
  heavy: {
    label: 'Power User',
    messagesPerDay: '~500 messages/day',
    providers: [
      { name: 'Ollama (local)', cost: '$0', note: 'Free. Consider a GPU for faster inference.' },
      { name: 'Claude Sonnet 4', cost: '~$75', note: 'Per month. Still no per-seat pricing.' },
      { name: 'GPT-4o', cost: '~$90', note: 'Per month. Scale to your entire team.' },
      { name: 'DeepSeek V3', cost: '~$4', note: 'Per month. Extremely competitive pricing.' },
    ],
  },
}

function CostCalculator() {
  const [level, setLevel] = useState<UsageLevel>('moderate')
  const estimate = usageLevels[level]

  return (
    <div
      className="glass-strong rounded-2xl p-6"
      style={{
        border: '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <Calculator size={18} style={{ color: 'var(--color-primary)' }} />
        <h4
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Cost Estimator
        </h4>
      </div>

      {/* Usage level selector */}
      <div className="flex gap-2 mb-4">
        {(Object.keys(usageLevels) as UsageLevel[]).map((key) => {
          const isActive = level === key
          return (
            <button
              key={key}
              onClick={() => setLevel(key)}
              className="flex-1 text-xs font-medium py-2 rounded-lg transition-all duration-200"
              style={{
                background: isActive
                  ? 'color-mix(in oklch, var(--color-glow-1) 18%, transparent)'
                  : 'color-mix(in oklch, var(--color-muted-foreground) 6%, transparent)',
                color: isActive ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                border: isActive
                  ? '1px solid color-mix(in oklch, var(--color-glow-1) 35%, transparent)'
                  : '1px solid transparent',
              }}
            >
              {usageLevels[key].label}
            </button>
          )
        })}
      </div>

      <p className="text-xs mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
        {estimate.messagesPerDay}
      </p>

      {/* Provider costs */}
      <div className="space-y-2.5">
        {estimate.providers.map((provider) => (
          <div
            key={provider.name}
            className="flex items-start justify-between gap-3 py-2 px-3 rounded-lg"
            style={{
              background: provider.cost === '$0'
                ? 'color-mix(in oklch, var(--color-glow-1) 6%, transparent)'
                : 'color-mix(in oklch, var(--color-muted-foreground) 4%, transparent)',
              border: provider.cost === '$0'
                ? '1px solid color-mix(in oklch, var(--color-glow-1) 15%, transparent)'
                : '1px solid transparent',
            }}
          >
            <div className="min-w-0">
              <p className="text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>
                {provider.name}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                {provider.note}
              </p>
            </div>
            <span
              className="text-sm font-bold flex-shrink-0"
              style={{
                color: provider.cost === '$0' ? 'var(--color-primary)' : 'var(--color-foreground)',
              }}
            >
              {provider.cost}
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px] mt-3" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
        Estimates based on ~2K tokens per message (input + output). Actual costs vary by conversation length and model.
      </p>
    </div>
  )
}

export function Pricing() {
  return (
    <section id="pricing" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Free. Forever.</span>
        </h2>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          No tiers, no limits, no surprise bills. KinBot is open source and self-hosted.
          You only pay for the AI providers you choose to use.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Main pricing card */}
        <div
          className="lg:col-span-3 glass-strong gradient-border rounded-2xl p-8 relative overflow-hidden"
          style={{ boxShadow: 'var(--shadow-md)' }}
        >
          {/* Background glow */}
          <div
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklch, var(--color-glow-1) 10%, transparent) 0%, transparent 70%)',
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    'color-mix(in oklch, var(--color-glow-1) 15%, transparent)',
                }}
              >
                <Infinity size={24} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <h3
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  $0
                  <span
                    className="text-base font-normal ml-1"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
                    /forever
                  </span>
                </h3>
                <p
                  className="text-sm"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Everything included. No catches.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
              {FREE_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-2.5">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        'color-mix(in oklch, var(--color-glow-1) 18%, transparent)',
                    }}
                  >
                    <Check
                      size={12}
                      style={{ color: 'var(--color-primary)' }}
                      strokeWidth={3}
                    />
                  </div>
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side cards */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Your only cost */}
          <div
            className="glass-strong rounded-2xl p-6"
            style={{
              border:
                '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <Server
                size={18}
                style={{ color: 'var(--color-muted-foreground)' }}
              />
              <h4
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                Your only costs
              </h4>
            </div>
            <div className="space-y-3">
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  AI API usage
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Pay-as-you-go to your chosen provider. Or use Ollama for
                  completely free local inference.
                </p>
              </div>
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  Hosting
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  A Raspberry Pi, old laptop, or $5/mo VPS. KinBot is
                  lightweight.
                </p>
              </div>
            </div>
          </div>

          {/* Cost comparison callout */}
          <div
            className="glass-strong rounded-2xl p-5"
            style={{
              background: 'color-mix(in oklch, var(--color-glow-1) 5%, var(--color-card))',
              border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={14} style={{ color: 'var(--color-primary)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                vs ChatGPT Pro
              </p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
              ChatGPT Pro costs $200/mo per user. With KinBot + Ollama, you get unlimited
              agents with persistent memory for $0. With cloud APIs, a typical user spends $3-20/mo
              with no per-seat pricing.
            </p>
          </div>
        </div>
      </div>

      {/* Cost estimator */}
      <div className="mt-8 max-w-xl mx-auto">
        <CostCalculator />
      </div>
    </section>
  )
}
