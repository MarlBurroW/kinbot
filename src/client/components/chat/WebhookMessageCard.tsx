import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/client/components/ui/collapsible'
import { Webhook, ChevronRight, GitPullRequest, MessageSquareText, CircleDot, Tag, GitCommit } from 'lucide-react'
import { cn } from '@/client/lib/utils'

interface WebhookMessageCardProps {
  content: string
  timestamp?: string
}

interface ParsedWebhook {
  name: string
  payload: string
  isJson: boolean
  parsed: Record<string, unknown> | null
}

function parseWebhookContent(content: string): ParsedWebhook {
  // Format: "[Webhook: name]\npayload"
  const match = content.match(/^\[Webhook:\s*(.+?)\]\s*\n?([\s\S]*)$/)
  if (!match) {
    return { name: 'webhook', payload: content, isJson: false, parsed: null }
  }

  const name = match[1]
  const payload = match[2]?.trim() ?? ''

  let parsed: Record<string, unknown> | null = null
  let isJson = false
  try {
    parsed = JSON.parse(payload)
    isJson = true
  } catch {
    // Not JSON, keep as plain text
  }

  return { name, payload, isJson, parsed }
}

// ─── GitHub event formatting ─────────────────────────────────────────────────

interface GitHubSummary {
  icon: typeof CircleDot
  text: string
}

function formatGitHubEvent(parsed: Record<string, unknown>): GitHubSummary | null {
  const action = parsed.action as string | undefined

  // Issues
  const issue = parsed.issue as Record<string, unknown> | undefined
  if (issue && !parsed.pull_request && !parsed.comment) {
    const number = issue.number as number
    const title = issue.title as string
    const user = (issue.user as Record<string, unknown>)?.login as string
    return {
      icon: CircleDot,
      text: `Issue #${number} ${action} — ${title} (${user})`,
    }
  }

  // Issue comments
  const comment = parsed.comment as Record<string, unknown> | undefined
  if (comment && issue) {
    const number = issue.number as number
    const user = (comment.user as Record<string, unknown>)?.login as string
    return {
      icon: MessageSquareText,
      text: `Comment on #${number} by ${user}`,
    }
  }

  // Pull requests
  const pr = parsed.pull_request as Record<string, unknown> | undefined
  if (pr) {
    const number = pr.number as number
    const title = pr.title as string
    const user = (pr.user as Record<string, unknown>)?.login as string
    return {
      icon: GitPullRequest,
      text: `PR #${number} ${action} — ${title} (${user})`,
    }
  }

  // Releases
  const release = parsed.release as Record<string, unknown> | undefined
  if (release) {
    const tagName = release.tag_name as string
    const name = release.name as string
    return {
      icon: Tag,
      text: `Release ${tagName} ${action}${name ? ` — ${name}` : ''}`,
    }
  }

  // Push events
  const commits = parsed.commits as Array<Record<string, unknown>> | undefined
  if (commits && parsed.ref) {
    const ref = (parsed.ref as string).replace('refs/heads/', '')
    const count = commits.length
    return {
      icon: GitCommit,
      text: `${count} commit${count !== 1 ? 's' : ''} pushed to ${ref}`,
    }
  }

  return null
}

// ─── Component ──────────────────────────────────────────────────────────────

export const WebhookMessageCard = memo(function WebhookMessageCard({
  content,
}: WebhookMessageCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const webhook = parseWebhookContent(content)

  const githubSummary = webhook.parsed ? formatGitHubEvent(webhook.parsed) : null
  const GitHubIcon = githubSummary?.icon ?? null

  const hasExpandableContent = webhook.payload.length > 0

  return (
    <div className="flex justify-center py-2 animate-fade-in-up">
      <Collapsible open={open} onOpenChange={setOpen} className="w-full max-w-md">
        <div className="surface-card rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center gap-3">
            {/* Webhook icon */}
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-chart-4/10">
              <Webhook className="size-4 text-chart-4" />
            </div>

            <div className="min-w-0 flex-1">
              {/* Webhook name */}
              <p className="text-sm font-medium text-foreground truncate">
                {webhook.name}
              </p>

              {/* GitHub summary or generic label */}
              <div className="mt-0.5 flex items-center gap-1.5">
                {githubSummary && GitHubIcon ? (
                  <>
                    <GitHubIcon className="size-3 shrink-0 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground truncate">
                      {githubSummary.text}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {t('chat.webhook.received')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Expandable payload */}
          {hasExpandableContent && (
            <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <ChevronRight
                className={cn(
                  'size-3 shrink-0 transition-transform duration-200',
                  open && 'rotate-90',
                )}
              />
              <span>{t('chat.webhook.showPayload')}</span>
            </CollapsibleTrigger>
          )}

          <CollapsibleContent>
            {hasExpandableContent && (
              <div className="mt-1 rounded-lg bg-muted/80 p-3 overflow-x-auto">
                <pre className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-all">
                  {webhook.isJson
                    ? JSON.stringify(webhook.parsed, null, 2)
                    : webhook.payload}
                </pre>
              </div>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  )
})
