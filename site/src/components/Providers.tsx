import Claude from '@lobehub/icons/es/Claude'
import OpenAI from '@lobehub/icons/es/OpenAI'
import Gemini from '@lobehub/icons/es/Gemini'
import Mistral from '@lobehub/icons/es/Mistral'
import DeepSeek from '@lobehub/icons/es/DeepSeek'
import Groq from '@lobehub/icons/es/Groq'
import Ollama from '@lobehub/icons/es/Ollama'
import Together from '@lobehub/icons/es/Together'
import Fireworks from '@lobehub/icons/es/Fireworks'
import Voyage from '@lobehub/icons/es/Voyage'
import OpenRouter from '@lobehub/icons/es/OpenRouter'
import Cohere from '@lobehub/icons/es/Cohere'
import XAI from '@lobehub/icons/es/XAI'
import Tavily from '@lobehub/icons/es/Tavily'
import Jina from '@lobehub/icons/es/Jina'
import Replicate from '@lobehub/icons/es/Replicate'
import Stability from '@lobehub/icons/es/Stability'
import Fal from '@lobehub/icons/es/Fal'
import Perplexity from '@lobehub/icons/es/Perplexity'

import type { ComponentType, SVGProps } from 'react'

type SvgIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

const fallBackIcon: SvgIcon = ({ size = 24, ...props }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect width="24" height="24" fill="#E0E0E0" />
    <path
      d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2ZM11.9999 7C12.5524 7 13.0999 7.22464 13.4141 7.58579C13.7283 7.94695 13.9999 8.41421 13.9999 9C13.9999 9.55248 13.7752 10.0999 13.4141 10.4141C13.053 10.7283 12.5524 10.9999 11.9999 10.9999C11.4475 10.9999 10.9936 10.7283 10.6325 10.4141C10.2714 10.0999 10.0467 9.55248 10.0467 9C10.0467 8.41421 10.3183 7.94695 10.6325 7.58579C10.9478 7.22464 11.4952 7 11.9999 7Z"
      fill="#B0B0B0"
    />
  </svg>
)



const providers: {
  name: string
  description: string
  capabilities: string[]
  Icon: SvgIcon
  color?: string
  imgFallback?: string
}[] = [
  {
    name: 'Anthropic',
    description: 'Claude models',
    capabilities: ['LLM'],
    Icon: Claude.Color,
  },
  {
    name: 'OpenAI',
    description: 'GPT, DALL·E, Embeddings',
    capabilities: ['LLM', 'Image', 'Embedding'],
    Icon: OpenAI,
  },
  {
    name: 'Google Gemini',
    description: 'Gemini models',
    capabilities: ['LLM', 'Image'],
    Icon: Gemini.Color,
  },
  {
    name: 'Mistral AI',
    description: 'European LLMs',
    capabilities: ['LLM'],
    Icon: Mistral.Color,
  },
  {
    name: 'DeepSeek',
    description: 'Reasoning models',
    capabilities: ['LLM'],
    Icon: DeepSeek.Color,
  },
  {
    name: 'Groq',
    description: 'Ultra-fast inference',
    capabilities: ['LLM'],
    Icon: Groq,
    color: '#F55036',
  },
  {
    name: 'Ollama',
    description: 'Local models, no API key',
    capabilities: ['LLM'],
    Icon: Ollama,
  },
  {
    name: 'Together AI',
    description: 'Open-source models',
    capabilities: ['LLM'],
    Icon: Together.Color,
  },
  {
    name: 'Fireworks AI',
    description: 'Fast open models',
    capabilities: ['LLM'],
    Icon: Fireworks.Color,
  },
  {
    name: 'Voyage AI',
    description: 'Specialized embeddings',
    capabilities: ['Embedding'],
    Icon: Voyage.Color,
  },
  {
    name: 'OpenRouter',
    description: 'Model aggregator',
    capabilities: ['LLM'],
    Icon: OpenRouter,
    color: '#6566F1',
  },
  {
    name: 'Cohere',
    description: 'LLM + Embeddings + Rerank',
    capabilities: ['LLM', 'Embedding'],
    Icon: Cohere.Color,
  },
  {
    name: 'xAI',
    description: 'Grok models',
    capabilities: ['LLM'],
    Icon: XAI,
  },
  {
    name: 'Brave Search',
    description: 'Web search API',
    capabilities: ['Search'],
    Icon: null as unknown as SvgIcon,
    imgFallback: 'https://cdn.simpleicons.org/brave/fb542b',
  },
  {
    name: 'Tavily',
    description: 'AI-optimized search',
    capabilities: ['Search'],
    Icon: Tavily.Color,
  },
  {
    name: 'Jina AI',
    description: 'Embeddings & reranking',
    capabilities: ['Embedding'],
    Icon: Jina,
  },
  {
    name: 'Nomic',
    description: 'Open-source embeddings',
    capabilities: ['Embedding'],
    Icon: null as unknown as SvgIcon,
    imgFallback: 'https://nomic.ai/favicon.ico',
  },
  {
    name: 'Replicate',
    description: 'Flux, SDXL & more',
    capabilities: ['Image'],
    Icon: Replicate,
  },
  {
    name: 'Stability AI',
    description: 'Stable Diffusion API',
    capabilities: ['Image'],
    Icon: Stability,
  },
  {
    name: 'FAL',
    description: 'Fast image inference',
    capabilities: ['Image'],
    Icon: Fal,
  },
  {
    name: 'Perplexity',
    description: 'Search + AI synthesis',
    capabilities: ['Search'],
    Icon: Perplexity.Color,
  },
  {
    name: 'Serper',
    description: 'Google SERP API',
    capabilities: ['Search'],
    Icon: fallBackIcon,
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
              {provider.imgFallback ? (
                <img
                  src={provider.imgFallback}
                  alt={provider.name}
                  className="w-10 h-10 transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <provider.Icon
                  size={40}
                  className="transition-transform duration-300 group-hover:scale-110"
                  {...(provider.color ? { color: provider.color } : {})}
                />
              )}
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
        22 providers and counting. Missing one?{' '}
        <a href="https://github.com/MarlBurroW/kinbot/issues" className="underline" style={{ color: 'var(--color-primary)' }}>Open an issue</a>.
      </p>
    </section>
  )
}
