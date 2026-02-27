import { MessageCircle, Hash, Slack, Phone, Shield, Grid3X3 } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'

type IconComponent = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

interface Channel {
  name: string
  description: string
  Icon: IconComponent
  color: string
}

const channels: Channel[] = [
  {
    name: 'Telegram',
    description: 'Message your Kins from anywhere. Send photos, files, and get instant replies with rich formatting.',
    Icon: ({ size = 24, ...props }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
      </svg>
    ),
    color: '#26A5E4',
  },
  {
    name: 'Discord',
    description: 'Your Kins join your server as bots. They see typing, split long replies, and feel native.',
    Icon: ({ size = 24, ...props }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
      </svg>
    ),
    color: '#5865F2',
  },
  {
    name: 'Slack',
    description: 'Drop a Kin into any workspace channel. It threads replies and respects your team\'s flow.',
    Icon: ({ size = 24, ...props }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
    color: '#4A154B',
  },
  {
    name: 'WhatsApp',
    description: 'Talk to your Kins in the same app you message everyone else. No extra apps to install.',
    Icon: ({ size = 24, ...props }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
    color: '#25D366',
  },
  {
    name: 'Signal',
    description: 'End-to-end encrypted conversations with your Kins. For when privacy is non-negotiable.',
    Icon: ({ size = 24, ...props }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 2.206c5.412 0 9.794 4.382 9.794 9.794S17.412 21.794 12 21.794 2.206 17.412 2.206 12 6.588 2.206 12 2.206zM8.526 7.298a.747.747 0 00-.528.218L6.746 8.77a.75.75 0 000 1.06l2.06 2.058-2.06 2.06a.75.75 0 000 1.06l1.252 1.252a.75.75 0 001.06 0l2.06-2.06 2.058 2.06a.75.75 0 001.06 0l1.253-1.253a.75.75 0 000-1.06l-2.06-2.059 2.06-2.058a.75.75 0 000-1.06l-1.253-1.253a.75.75 0 00-1.06 0l-2.058 2.06-2.06-2.06a.747.747 0 00-.532-.219z" />
      </svg>
    ),
    color: '#3A76F0',
  },
  {
    name: 'Matrix',
    description: 'Federated, self-hosted chat. Your Kins live in your Matrix rooms alongside your team.',
    Icon: ({ size = 24, ...props }) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M.632.55v22.9H2.28V24H0V0h2.28v.55zm7.043 7.26v1.157h.033c.309-.443.683-.784 1.117-1.024.433-.245.936-.365 1.5-.365.54 0 1.033.107 1.488.32.45.214.773.553.964 1.02.309-.4.694-.72 1.154-.96.459-.24.96-.363 1.5-.363.41 0 .794.07 1.153.197.36.13.665.32.913.563.249.246.44.55.576.916.135.366.2.788.2 1.264v5.973h-2.11V11.4c0-.3-.017-.58-.05-.838a1.707 1.707 0 00-.2-.653 1.075 1.075 0 00-.41-.435c-.17-.105-.4-.158-.68-.158-.277 0-.503.058-.68.175a1.19 1.19 0 00-.42.463 2.02 2.02 0 00-.208.682c-.037.264-.054.543-.054.837v4.504h-2.11v-5.09c0-.267-.008-.53-.025-.79a2.138 2.138 0 00-.15-.673 1.037 1.037 0 00-.378-.475c-.17-.12-.41-.18-.72-.18-.1 0-.234.03-.4.09-.169.058-.33.165-.492.32-.16.155-.3.377-.408.665-.11.287-.166.662-.166 1.12v5.013H5.565V7.81zm13.04 16.19V.55h1.647V0H24v24h-2.28v-.55z" />
      </svg>
    ),
    color: '#0DBD8B',
  },
]

export function Channels() {
  return (
    <section id="channels" className="px-6 py-24 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <h2 className="text-4xl sm:text-5xl font-bold mb-4">
          <span style={{ color: 'var(--color-foreground)' }}>Meet your agents</span>{' '}
          <span className="gradient-text">where you are.</span>
        </h2>
        <p
          className="text-lg max-w-2xl mx-auto"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          Your Kins aren't trapped in a web UI. Connect them to the apps you already use, and they'll maintain full context across every platform.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {channels.map((channel) => (
          <div
            key={channel.name}
            className="glass-strong gradient-border rounded-2xl p-6 transition-all duration-300 hover:scale-[1.03] hover:shadow-lg group"
            style={{ boxShadow: 'var(--shadow-md)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                style={{
                  background: `color-mix(in oklch, ${channel.color} 15%, transparent)`,
                  color: channel.color,
                }}
              >
                <channel.Icon size={22} />
              </div>
              <h3
                className="font-semibold text-base"
                style={{ color: 'var(--color-foreground)' }}
              >
                {channel.name}
              </h3>
            </div>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {channel.description}
            </p>
          </div>
        ))}
      </div>

      <p
        className="text-center mt-8 text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        The channel adapter architecture makes adding new platforms straightforward.{' '}
        <a
          href="https://github.com/MarlBurroW/kinbot/blob/main/CONTRIBUTING.md"
          className="underline"
          style={{ color: 'var(--color-primary)' }}
        >
          Want to add one?
        </a>
      </p>
    </section>
  )
}
