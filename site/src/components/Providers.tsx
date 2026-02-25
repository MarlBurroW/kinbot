const providers = [
  {
    name: 'Anthropic',
    description: 'Claude models',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/anthropic',
  },
  {
    name: 'OpenAI',
    description: 'GPT, DALL·E, Embeddings',
    capabilities: ['LLM', 'Image', 'Embedding'],
    logo: 'https://cdn.simpleicons.org/openai',
  },
  {
    name: 'Google Gemini',
    description: 'Gemini models',
    capabilities: ['LLM', 'Image'],
    logo: 'https://cdn.simpleicons.org/googlegemini',
  },
  {
    name: 'Mistral AI',
    description: 'European LLMs',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/mistral',
  },
  {
    name: 'DeepSeek',
    description: 'Reasoning models',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/deepseek',
  },
  {
    name: 'Groq',
    description: 'Ultra-fast inference',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/groq',
  },
  {
    name: 'Ollama',
    description: 'Local models, no API key',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/ollama',
  },
  {
    name: 'Together AI',
    description: 'Open-source models',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/togetherai',
  },
  {
    name: 'Fireworks AI',
    description: 'Fast open models',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/fireship',
  },
  {
    name: 'Voyage AI',
    description: 'Specialized embeddings',
    capabilities: ['Embedding'],
    logo: 'https://cdn.simpleicons.org/v',
  },
  {
    name: 'OpenRouter',
    description: 'Model aggregator',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/openrouter',
  },
  {
    name: 'Cohere',
    description: 'LLM + Embeddings + Rerank',
    capabilities: ['LLM', 'Embedding'],
    logo: 'https://cdn.simpleicons.org/cohere',
  },
  {
    name: 'xAI',
    description: 'Grok models',
    capabilities: ['LLM'],
    logo: 'https://cdn.simpleicons.org/x',
  },
  {
    name: 'Brave Search',
    description: 'Web search API',
    capabilities: ['Search'],
    logo: 'https://cdn.simpleicons.org/brave',
  },
]

const capabilityColors: Record<string, string> = {
  LLM: 'var(--color-glow-1)',
  Image: 'var(--color-glow-2)',
  Embedding: 'var(--color-primary)',
  Search: 'var(--color-accent, var(--color-glow-1))',
}

export function Providers() {
  return (
    <section id="providers" className="px-6 py-24 max-w-7xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">Your models, your choice.</span>
        </h2>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Connect any combination of providers. Capabilities are auto-detected.
          Add an API key and you're ready to go.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {providers.map((provider) => (
          <div
            key={provider.name}
            className="glass-strong gradient-border rounded-2xl p-5 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group text-center"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex justify-center mb-3">
              <img
                src={provider.logo}
                alt={provider.name}
                className="w-10 h-10 transition-transform duration-300 group-hover:scale-110 dark:invert"
                loading="lazy"
              />
            </div>
            <h3
              className="font-semibold text-sm mb-1"
              style={{ color: 'var(--color-foreground)' }}
            >
              {provider.name}
            </h3>
            <p
              className="text-xs mb-3"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {provider.description}
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {provider.capabilities.map((cap) => (
                <span
                  key={cap}
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{
                    background: `color-mix(in oklch, ${capabilityColors[cap] || 'var(--color-glow-1)'} 15%, transparent)`,
                    color: capabilityColors[cap] || 'var(--color-glow-1)',
                    border: `1px solid color-mix(in oklch, ${capabilityColors[cap] || 'var(--color-glow-1)'} 25%, transparent)`,
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p
        className="text-center mt-8 text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        More providers coming soon — Replicate, Stability AI, Tavily, Jina AI, and more.
      </p>
    </section>
  )
}
