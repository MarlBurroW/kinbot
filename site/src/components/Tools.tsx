import { useState, useRef, useEffect } from 'react'
import {
  Brain,
  Globe,
  Users,
  Lock,
  Bot,
  Clock,
  AppWindow,
  MessageSquare,
  Wrench,
  FileImage,
  Terminal,
  HandMetal,
  ChevronDown,
} from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type Icon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

interface ToolCategory {
  icon: Icon
  name: string
  description: string
  tools: string[]
  accent: string
}

const categories: ToolCategory[] = [
  {
    icon: Brain,
    name: 'Memory & Knowledge',
    description: 'Recall, memorize, and search across months of context',
    tools: ['recall', 'memorize', 'update_memory', 'forget', 'list_memories', 'search_history'],
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Globe,
    name: 'Web & Browsing',
    description: 'Search the web, browse URLs, take screenshots',
    tools: ['web_search', 'browse_url', 'extract_links', 'screenshot_url'],
    accent: 'var(--color-glow-2)',
  },
  {
    icon: Users,
    name: 'Contacts',
    description: 'Manage a contacts directory for your agents',
    tools: ['get_contact', 'search_contacts', 'create_contact', 'update_contact', 'delete_contact', 'find_contact_by_identifier'],
    accent: 'var(--color-glow-3)',
  },
  {
    icon: Lock,
    name: 'Vault & Secrets',
    description: 'AES-256 encrypted secrets, never exposed in prompts',
    tools: ['get_secret', 'create_secret', 'update_secret', 'delete_secret', 'search_secrets', 'redact_message'],
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Bot,
    name: 'Multi-Agent',
    description: 'Spawn sub-agents, delegate tasks, collaborate',
    tools: ['spawn_self', 'spawn_kin', 'send_message', 'reply', 'list_kins', 'report_to_parent', 'request_input'],
    accent: 'var(--color-glow-2)',
  },
  {
    icon: Clock,
    name: 'Automation',
    description: 'Cron jobs, webhooks, scheduled wake-ups',
    tools: ['create_cron', 'update_cron', 'delete_cron', 'list_crons', 'wake_me_in', 'cancel_wakeup'],
    accent: 'var(--color-glow-3)',
  },
  {
    icon: AppWindow,
    name: 'Mini Apps',
    description: 'Build interactive UIs right in the sidebar',
    tools: ['create_app', 'update_app', 'delete_app', 'read_file', 'write_file', 'snapshot', 'rollback', 'kv_storage', 'clone_from_gallery'],
    accent: 'var(--color-glow-1)',
  },
  {
    icon: MessageSquare,
    name: 'Channels',
    description: 'Send messages to Telegram, Discord, Slack, and more',
    tools: ['list_channels', 'list_channel_conversations', 'send_channel_message'],
    accent: 'var(--color-glow-2)',
  },
  {
    icon: Wrench,
    name: 'Custom Tools',
    description: 'Agents create and run their own scripts',
    tools: ['register_tool', 'run_custom_tool', 'list_custom_tools'],
    accent: 'var(--color-glow-3)',
  },
  {
    icon: FileImage,
    name: 'Files & Images',
    description: 'Store files, generate images, manage assets',
    tools: ['store_file', 'get_stored_file', 'search_stored_files', 'generate_image', 'list_image_models'],
    accent: 'var(--color-glow-1)',
  },
  {
    icon: Terminal,
    name: 'System',
    description: 'Shell commands, SQL queries, platform logs',
    tools: ['run_shell', 'execute_sql', 'get_platform_logs', 'notify', 'user_management', 'mcp_management'],
    accent: 'var(--color-glow-2)',
  },
  {
    icon: HandMetal,
    name: 'Human-in-the-Loop',
    description: 'Ask users for approval before sensitive actions',
    tools: ['prompt_human', 'notify'],
    accent: 'var(--color-glow-3)',
  },
]

const totalTools = categories.reduce((sum, cat) => sum + cat.tools.length, 0)

function CategoryCard({
  category,
  visible,
  isExpanded,
  onToggle,
}: {
  category: ToolCategory
  visible: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const { icon: Icon, name, description, tools, accent } = category
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight)
    }
  }, [isExpanded])

  return (
    <div
      className="rounded-xl transition-all duration-300 cursor-pointer group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition:
          'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, box-shadow 0.3s',
        background: isExpanded
          ? `color-mix(in oklch, ${accent} 5%, var(--color-card))`
          : 'var(--color-glass-strong-bg, var(--color-card))',
        border: isExpanded
          ? `1px solid color-mix(in oklch, ${accent} 35%, transparent)`
          : '1px solid color-mix(in oklch, var(--color-border) 50%, transparent)',
        boxShadow: isExpanded
          ? `0 0 24px color-mix(in oklch, ${accent} 12%, transparent)`
          : 'none',
      }}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3 p-4">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
          style={{
            background: `color-mix(in oklch, ${accent} 15%, transparent)`,
            border: `1px solid color-mix(in oklch, ${accent} 25%, transparent)`,
          }}
        >
          <Icon size={16} style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--color-foreground)' }}
            >
              {name}
            </h3>
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{
                background: `color-mix(in oklch, ${accent} 12%, transparent)`,
                color: accent,
              }}
            >
              {tools.length}
            </span>
          </div>
          <p
            className="text-xs truncate"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {description}
          </p>
        </div>
        <ChevronDown
          size={14}
          className="flex-shrink-0 transition-transform duration-300"
          style={{
            color: 'var(--color-muted-foreground)',
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>

      {/* Expandable tool list */}
      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isExpanded ? `${height}px` : '0',
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 pt-0">
          <div className="flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <span
                key={tool}
                className="text-[11px] font-mono px-2 py-1 rounded-md"
                style={{
                  background: `color-mix(in oklch, ${accent} 8%, transparent)`,
                  color: `color-mix(in oklch, ${accent} 70%, var(--color-muted-foreground))`,
                  border: `1px solid color-mix(in oklch, ${accent} 15%, transparent)`,
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Tools() {
  const gridRef = useRef<HTMLDivElement>(null)
  const [visibleSet, setVisibleSet] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<number | null>(null)
  const observedRef = useRef(false)

  useEffect(() => {
    const el = gridRef.current
    if (!el || observedRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observedRef.current = true
          observer.unobserve(el)
          categories.forEach((_, i) => {
            setTimeout(() => {
              setVisibleSet((prev) => new Set(prev).add(i))
            }, i * 50)
          })
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="tools" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span className="gradient-text">{totalTools}+ tools</span>{' '}
          <span style={{ color: 'var(--color-foreground)' }}>out of the box.</span>
        </h2>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          No plugins to install. No config files to write. Every Kin comes loaded with
          everything it needs to be useful from day one.
        </p>
      </div>

      <div
        ref={gridRef}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
      >
        {categories.map((cat, i) => (
          <CategoryCard
            key={cat.name}
            category={cat}
            visible={visibleSet.has(i)}
            isExpanded={expanded === i}
            onToggle={() => setExpanded(expanded === i ? null : i)}
          />
        ))}
      </div>

      <p
        className="text-center mt-8 text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        Plus any tools you add via{' '}
        <a href="#features" className="underline" style={{ color: 'var(--color-primary)' }}>
          MCP servers
        </a>{' '}
        or{' '}
        <a href="#features" className="underline" style={{ color: 'var(--color-primary)' }}>
          custom scripts
        </a>
        .
      </p>
    </section>
  )
}
