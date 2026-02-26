import { Check, X, Minus } from 'lucide-react'

type Support = 'yes' | 'no' | 'partial'

interface Row {
  feature: string
  kinbot: Support
  chatgpt: Support
  openwebui: Support
  librechat: Support
  anythingllm: Support
}

const rows: Row[] = [
  { feature: 'Self-hosted / your data', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', librechat: 'yes', anythingllm: 'yes' },
  { feature: 'Persistent agent identity', kinbot: 'yes', chatgpt: 'partial', openwebui: 'no', librechat: 'no', anythingllm: 'partial' },
  { feature: 'Long-term memory', kinbot: 'yes', chatgpt: 'partial', openwebui: 'no', librechat: 'no', anythingllm: 'partial' },
  { feature: 'Session compacting', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'Inter-agent communication', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'Sub-tasks / delegation', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'Cron jobs / autonomy', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'Encrypted vault', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'MCP tool servers', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', librechat: 'no', anythingllm: 'no' },
  { feature: 'Multi-provider (25+)', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', librechat: 'yes', anythingllm: 'yes' },
  { feature: 'Webhooks', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'Chat integrations (6 platforms)', kinbot: 'yes', chatgpt: 'no', openwebui: 'no', librechat: 'no', anythingllm: 'no' },
  { feature: 'RAG / document embedding', kinbot: 'no', chatgpt: 'partial', openwebui: 'yes', librechat: 'no', anythingllm: 'yes' },
  { feature: 'Multi-user with roles', kinbot: 'yes', chatgpt: 'yes', openwebui: 'yes', librechat: 'yes', anythingllm: 'yes' },
  { feature: 'Free & open source', kinbot: 'yes', chatgpt: 'no', openwebui: 'yes', librechat: 'yes', anythingllm: 'yes' },
]

function Cell({ value }: { value: Support }) {
  if (value === 'yes') {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ background: 'color-mix(in oklch, var(--color-glow-1) 20%, transparent)' }}
      >
        <Check size={14} style={{ color: 'var(--color-primary)' }} strokeWidth={3} />
      </span>
    )
  }
  if (value === 'partial') {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full"
        style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 15%, transparent)' }}
      >
        <Minus size={14} style={{ color: 'var(--color-muted-foreground)' }} strokeWidth={3} />
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full"
      style={{ background: 'color-mix(in oklch, var(--color-muted-foreground) 10%, transparent)' }}
    >
      <X size={14} style={{ color: 'var(--color-muted-foreground)', opacity: 0.5 }} strokeWidth={3} />
    </span>
  )
}

export function Comparison() {
  return (
    <section id="comparison" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">How KinBot compares.</span>
        </h2>
        <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--color-muted-foreground)' }}>
          Not another chat wrapper. KinBot gives your agents identity, memory, and autonomy.
        </p>
      </div>

      <div
        className="glass-strong gradient-border rounded-2xl overflow-hidden"
        style={{ boxShadow: 'var(--shadow-md)' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid color-mix(in oklch, var(--color-border) 60%, transparent)' }}>
                <th
                  className="text-left py-4 px-5 font-semibold"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  Feature
                </th>
                <th className="py-4 px-4 text-center font-semibold">
                  <span className="gradient-text">KinBot</span>
                </th>
                <th
                  className="py-4 px-4 text-center font-medium"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  ChatGPT
                </th>
                <th
                  className="py-4 px-4 text-center font-medium"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  Open WebUI
                </th>
                <th
                  className="py-4 px-4 text-center font-medium"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  LibreChat
                </th>
                <th
                  className="py-4 px-4 text-center font-medium"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  AnythingLLM
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.feature}
                  className="transition-colors duration-150"
                  style={{
                    borderBottom:
                      i < rows.length - 1
                        ? '1px solid color-mix(in oklch, var(--color-border) 30%, transparent)'
                        : undefined,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      'color-mix(in oklch, var(--color-glow-1) 5%, transparent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <td className="py-3 px-5" style={{ color: 'var(--color-foreground)' }}>
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Cell value={row.kinbot} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Cell value={row.chatgpt} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Cell value={row.openwebui} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Cell value={row.librechat} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <Cell value={row.anythingllm} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-center mt-6 text-xs" style={{ color: 'var(--color-muted-foreground)', opacity: 0.7 }}>
        Comparison based on default capabilities as of February 2026. Some features may be available via plugins.
      </p>
    </section>
  )
}
