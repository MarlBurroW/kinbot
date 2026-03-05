import { useMemo } from 'react'
import {
  Puzzle,
  Blocks,
  Terminal,
  ShieldCheck,
  Zap,
  Package,
  Wrench,
  Brain,
  MessageSquare,
  Webhook,
} from 'lucide-react'
import { highlight } from 'sugar-high'
import type { ComponentType, SVGProps } from 'react'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

interface PluginType {
  icon: Icon
  name: string
  description: string
  examples: string[]
  accent: string
}

const pluginTypes: PluginType[] = [
  {
    icon: Wrench,
    name: 'Tools',
    description: 'Add new capabilities your Kins can invoke via AI tool-calling',
    examples: ['Home automation', 'CRM integration', 'Custom APIs', 'IoT devices'],
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Brain,
    name: 'Providers',
    description: 'Connect new LLM, embedding, image, or search backends',
    examples: ['Self-hosted models', 'Custom embeddings', 'Niche AI services'],
    accent: 'var(--color-glow-2)',
  },
  {
    icon: MessageSquare,
    name: 'Channels',
    description: 'Bridge new messaging platforms for your agents',
    examples: ['IRC', 'Teams', 'Custom chat UIs', 'SMS gateways'],
    accent: 'var(--color-glow-3)',
  },
  {
    icon: Webhook,
    name: 'Hooks',
    description: 'Intercept lifecycle events like beforeChat, afterToolCall, and more',
    examples: ['Logging', 'Rate limiting', 'Content filtering', 'Analytics'],
    accent: 'var(--color-glow-1)',
  },
]

interface Feature {
  icon: Icon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Zap,
    title: 'Hot-Reloadable',
    description: 'Drop a folder into plugins/ and it loads instantly. No restart needed.',
  },
  {
    icon: Terminal,
    title: 'Scaffold in Seconds',
    description: 'Run bunx create-kinbot-plugin to generate a ready-to-go plugin template.',
  },
  {
    icon: ShieldCheck,
    title: 'Permission System',
    description: 'Plugins declare permissions upfront. Users approve before activation.',
  },
  {
    icon: Package,
    title: 'Community Registry',
    description: 'Install from git, npm, or browse the community plugin registry.',
  },
]

const manifestExample = `{
  "name": "my-plugin",
  "version": "1.0.0",
  "types": ["tool"],
  "permissions": ["network"],
  "settings": {
    "apiKey": {
      "type": "secret",
      "label": "API Key",
      "required": true
    }
  }
}`

const codeExample = `import { definePlugin } from 'kinbot/sdk'

export default definePlugin({
  tools: [{
    name: 'check_weather',
    description: 'Get current weather',
    parameters: z.object({
      city: z.string()
    }),
    async execute({ city }) {
      const data = await fetch(\`...\`)
      return { temperature: data.temp }
    }
  }]
})`

function HighlightedCode({ code }: { code: string }) {
  const html = useMemo(() => highlight(code), [code])
  return (
    <pre className="p-4 text-sm font-mono overflow-x-auto leading-relaxed">
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  )
}

export function Plugins() {
  return (
    <section id="plugins" className="py-24 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full opacity-[0.03]"
          style={{
            background:
              'radial-gradient(circle, var(--color-glow-1) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="px-6 max-w-5xl mx-auto relative z-10">
        {/* Section header */}
        <div className="text-center mb-16">
          <div
            className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm mb-6"
            style={{
              border: '1px solid var(--color-border)',
              background: 'var(--color-secondary)',
              color: 'var(--color-muted-foreground)',
            }}
          >
            <Puzzle className="w-4 h-4" style={{ color: 'var(--color-glow-2)' }} />
            Extensibility
          </div>
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="gradient-text">Plugin System</span>
          </h2>
          <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
            Extend KinBot with custom tools, providers, channels, and hooks.
            TypeScript-first, hot-reloadable, and secure by design.
          </p>
        </div>

        {/* Plugin types grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {pluginTypes.map((type) => (
            <div
              key={type.name}
              className="glass-strong rounded-xl p-6 group transition-all duration-300"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: `color-mix(in oklch, ${type.accent} 12%, var(--color-background))`,
                  border: `1px solid color-mix(in oklch, ${type.accent} 25%, transparent)`,
                }}
              >
                <type.icon className="w-6 h-6" style={{ color: type.accent }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-foreground)' }}>{type.name}</h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-muted-foreground)' }}>{type.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {type.examples.map((ex) => (
                  <span
                    key={ex}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      background: 'var(--color-secondary)',
                      color: 'var(--color-muted-foreground)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {ex}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Features row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {features.map((feat) => (
            <div key={feat.title} className="flex gap-4">
              <div
                className="w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center"
                style={{
                  background: 'color-mix(in oklch, var(--color-glow-2) 12%, var(--color-background))',
                  border: '1px solid color-mix(in oklch, var(--color-glow-2) 25%, transparent)',
                }}
              >
                <feat.icon className="w-5 h-5" style={{ color: 'var(--color-glow-2)' }} />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--color-foreground)' }}>{feat.title}</h4>
                <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>{feat.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Code examples */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-strong rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-secondary)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-muted-foreground)' }}>plugin.json</span>
            </div>
            <HighlightedCode code={manifestExample} />
          </div>

          <div className="glass-strong rounded-xl overflow-hidden">
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-secondary)' }}
            >
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs ml-2 font-mono" style={{ color: 'var(--color-muted-foreground)' }}>index.ts</span>
            </div>
            <HighlightedCode code={codeExample} />
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <p className="mb-4" style={{ color: 'var(--color-muted-foreground)' }}>
            Create your first plugin in under a minute
          </p>
          <div
            className="inline-flex items-center gap-3 glass-strong rounded-xl px-5 py-3 font-mono text-sm"
          >
            <Terminal className="w-4 h-4" style={{ color: 'var(--color-glow-2)' }} />
            <span style={{ color: 'var(--color-muted-foreground)' }}>$</span>
            <span style={{ color: 'var(--color-foreground)' }}>bunx create-kinbot-plugin</span>
          </div>
        </div>
      </div>
    </section>
  )
}
