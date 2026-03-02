import { FlaskConical, MessageSquarePlus, Github, Rocket, Heart } from 'lucide-react'

export function EarlyAccess() {
  return (
    <section id="early-access" className="px-6 py-24">
      <div className="max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6 tracking-wide uppercase"
          style={{
            background: 'color-mix(in oklch, var(--color-glow-1) 12%, transparent)',
            color: 'var(--color-primary)',
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 20%, transparent)',
          }}
        >
          <FlaskConical size={13} />
          Early Access
        </div>

        {/* Heading */}
        <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--color-foreground)' }}>
          Help shape KinBot
        </h2>

        <p className="text-lg mb-6 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--color-muted-foreground)' }}>
          KinBot is under active development. I'm building this solo and I need your help to make it better.
          It's usable today, but there's still a lot of ground to cover. If you like tinkering with AI agents
          and don't mind the occasional rough edge, I'd love your feedback.
        </p>

        {/* What testers do */}
        <div
          className="rounded-2xl p-6 sm:p-8 mb-8 text-left glass"
          style={{
            background: 'color-mix(in oklch, var(--color-glow-1) 5%, var(--color-card))',
            border: '1px solid color-mix(in oklch, var(--color-glow-1) 12%, transparent)',
          }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--color-primary)' }}>
            What early testers do
          </h3>
          <ul className="space-y-3">
            {[
              { icon: Rocket, text: 'Install KinBot, set up a Kin, and push it to its limits' },
              { icon: MessageSquarePlus, text: 'Report bugs, suggest features, share what works and what doesn\'t' },
              { icon: Heart, text: 'Help prioritize what matters most to real users' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <Icon
                  size={18}
                  className="mt-0.5 shrink-0"
                  style={{ color: 'var(--color-primary)' }}
                />
                <span className="text-sm" style={{ color: 'var(--color-foreground)' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm mb-8" style={{ color: 'var(--color-muted-foreground)' }}>
          No sign-up, no waitlist. Just clone the repo, follow the install guide, and start experimenting.
          Every issue you open helps make KinBot better for everyone.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="https://github.com/MarlBurroW/kinbot#quick-start"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'var(--color-primary)',
              color: 'var(--color-primary-foreground)',
              boxShadow: '0 0 30px color-mix(in oklch, var(--color-glow-1) 35%, transparent)',
            }}
          >
            <Rocket size={18} />
            Try it out
          </a>
          <a
            href="https://github.com/MarlBurroW/kinbot/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 hover:scale-105 active:scale-95 glass"
            style={{ color: 'var(--color-foreground)' }}
          >
            <Github size={18} />
            Open an issue
          </a>
        </div>
      </div>
    </section>
  )
}
