import { Check, Infinity, Server, Heart } from 'lucide-react'

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

const CLOUD_COSTS = [
  { service: 'ChatGPT Plus', price: '$20/mo', note: 'per user' },
  { service: 'Claude Pro', price: '$20/mo', note: 'per user' },
  { service: 'Gemini Advanced', price: '$20/mo', note: 'per user' },
]

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

        {/* Side card: what you actually pay for */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Your only cost */}
          <div
            className="glass-strong rounded-2xl p-6 flex-1"
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

          {/* Cloud comparison */}
          <div
            className="glass-strong rounded-2xl p-6"
            style={{
              border:
                '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
            }}
          >
            <div className="flex items-center gap-2.5 mb-4">
              <Heart
                size={18}
                style={{ color: 'var(--color-muted-foreground)' }}
              />
              <h4
                className="text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                Meanwhile, cloud AI
              </h4>
            </div>
            <div className="space-y-2">
              {CLOUD_COSTS.map(({ service, price, note }) => (
                <div
                  key={service}
                  className="flex items-center justify-between py-2 px-3 rounded-lg"
                  style={{
                    background:
                      'color-mix(in oklch, var(--color-muted-foreground) 5%, transparent)',
                  }}
                >
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-foreground)' }}
                  >
                    {service}
                  </span>
                  <div className="text-right">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: 'var(--color-muted-foreground)' }}
                    >
                      {price}
                    </span>
                    <span
                      className="text-xs ml-1"
                      style={{
                        color: 'var(--color-muted-foreground)',
                        opacity: 0.6,
                      }}
                    >
                      {note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p
              className="text-xs mt-3 text-center"
              style={{
                color: 'var(--color-muted-foreground)',
                opacity: 0.7,
              }}
            >
              No memory. No autonomy. No self-hosting. Usage caps.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
