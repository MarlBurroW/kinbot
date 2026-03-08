import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import githubNotifications from './index'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FAKE_TOKEN = 'ghp_test_token_123'
const FAKE_REPO = 'owner/repo'

function createPlugin(config: Record<string, string> = {}) {
  return githubNotifications({
    token: FAKE_TOKEN,
    defaultRepo: FAKE_REPO,
    ...config,
  })
}

function createPluginNoToken(config: Record<string, string> = {}) {
  return githubNotifications(config)
}

const toolCtx = { toolCallId: 'test', messages: [] } as any

// ─── Mock fetch ──────────────────────────────────────────────────────────────

let fetchMock: ReturnType<typeof mock>

beforeEach(() => {
  fetchMock = mock(() =>
    Promise.resolve(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
  globalThis.fetch = fetchMock as any
})

afterEach(() => {
  // @ts-ignore
  delete globalThis.fetch
})

function mockFetchResponse(data: unknown, status = 200) {
  fetchMock.mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  )
}

function mockFetchError(status: number, body = 'error') {
  fetchMock.mockImplementation(() =>
    Promise.resolve(new Response(body, { status })),
  )
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('github-notifications plugin', () => {
  describe('configuration', () => {
    it('throws when token is not set', async () => {
      const plugin = createPluginNoToken()
      await expect(
        plugin.tools.github_notifications.execute(
          { filter: 'unread', max: 15 },
          toolCtx,
        ),
      ).rejects.toThrow(/token not configured/i)
    })

    it('throws when no repo specified and no default', async () => {
      const plugin = createPluginNoToken({ token: FAKE_TOKEN })
      await expect(
        plugin.tools.github_issues.execute(
          { state: 'open', max: 10 },
          toolCtx,
        ),
      ).rejects.toThrow(/no repository specified/i)
    })

    it('throws when repo format is invalid (no slash)', async () => {
      const plugin = createPluginNoToken({ token: FAKE_TOKEN, defaultRepo: 'noslash' })
      await expect(
        plugin.tools.github_issues.execute(
          { state: 'open', max: 10 },
          toolCtx,
        ),
      ).rejects.toThrow(/no repository specified/i)
    })
  })

  describe('github_notifications', () => {
    it('returns message when no unread notifications', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      const result = await plugin.tools.github_notifications.execute(
        { filter: 'unread', max: 15 },
        toolCtx,
      )
      expect(result).toContain('No unread notifications')
    })

    it('returns different message for "all" filter with no results', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      const result = await plugin.tools.github_notifications.execute(
        { filter: 'all', max: 15 },
        toolCtx,
      )
      expect(result).toContain('No notifications found')
    })

    it('formats notifications correctly', async () => {
      mockFetchResponse([
        {
          id: '1',
          reason: 'mention',
          unread: true,
          updated_at: '2026-01-01T00:00:00Z',
          subject: { title: 'Fix bug', type: 'Issue', url: '' },
          repository: { full_name: 'owner/repo' },
        },
        {
          id: '2',
          reason: 'review_requested',
          unread: false,
          updated_at: '2026-01-01T00:00:00Z',
          subject: { title: 'Add feature', type: 'PullRequest', url: '' },
          repository: { full_name: 'owner/repo' },
        },
      ])

      const plugin = createPlugin()
      const result = await plugin.tools.github_notifications.execute(
        { filter: 'all', max: 15 },
        toolCtx,
      )
      expect(result).toContain('2 notification(s)')
      expect(result).toContain('🔴')
      expect(result).toContain('⚪')
      expect(result).toContain('[Issue]')
      expect(result).toContain('[PR]')
      expect(result).toContain('Fix bug')
      expect(result).toContain('Add feature')
      expect(result).toContain('mention')
      expect(result).toContain('review_requested')
    })

    it('sends correct query params for unread filter', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      await plugin.tools.github_notifications.execute(
        { filter: 'unread', max: 5 },
        toolCtx,
      )

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(url.pathname).toBe('/notifications')
      expect(url.searchParams.get('per_page')).toBe('5')
      expect(url.searchParams.has('all')).toBe(false)
    })

    it('sends all=true for "all" filter', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      await plugin.tools.github_notifications.execute(
        { filter: 'all', max: 10 },
        toolCtx,
      )

      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(url.searchParams.get('all')).toBe('true')
    })
  })

  describe('github_issues', () => {
    it('filters out pull requests from issue results', async () => {
      mockFetchResponse([
        {
          number: 1,
          title: 'Real issue',
          state: 'open',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          labels: [],
          comments: 0,
          html_url: 'https://github.com/owner/repo/issues/1',
        },
        {
          number: 2,
          title: 'Actually a PR',
          state: 'open',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          labels: [],
          comments: 0,
          html_url: 'https://github.com/owner/repo/issues/2',
          pull_request: { url: 'https://api.github.com/repos/owner/repo/pulls/2' },
        },
      ])

      const plugin = createPlugin()
      const result = await plugin.tools.github_issues.execute(
        { state: 'open', max: 10 },
        toolCtx,
      )
      expect(result).toContain('1 open issue(s)')
      expect(result).toContain('Real issue')
      expect(result).not.toContain('Actually a PR')
    })

    it('shows labels when present', async () => {
      mockFetchResponse([
        {
          number: 1,
          title: 'Bug report',
          state: 'open',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          labels: [{ name: 'bug' }, { name: 'critical' }],
          comments: 3,
          html_url: 'https://github.com/owner/repo/issues/1',
        },
      ])

      const plugin = createPlugin()
      const result = await plugin.tools.github_issues.execute(
        { state: 'open', max: 10 },
        toolCtx,
      )
      expect(result).toContain('[bug, critical]')
      expect(result).toContain('3 comment(s)')
    })

    it('returns empty message when no issues', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      const result = await plugin.tools.github_issues.execute(
        { state: 'open', max: 10 },
        toolCtx,
      )
      expect(result).toContain('No open issues found')
    })

    it('uses explicit repo over default', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      await plugin.tools.github_issues.execute(
        { repo: 'other/project', state: 'open', max: 10 },
        toolCtx,
      )

      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(url.pathname).toBe('/repos/other/project/issues')
    })

    it('passes labels and assignee params', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      await plugin.tools.github_issues.execute(
        { state: 'open', labels: 'bug,help wanted', assignee: 'alice', max: 5 },
        toolCtx,
      )

      const url = new URL(fetchMock.mock.calls[0][0] as string)
      expect(url.searchParams.get('labels')).toBe('bug,help wanted')
      expect(url.searchParams.get('assignee')).toBe('alice')
    })
  })

  describe('github_pull_requests', () => {
    it('formats PRs with correct status icons', async () => {
      mockFetchResponse([
        {
          number: 10,
          title: 'Open PR',
          state: 'open',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          draft: false,
          merged_at: null,
          html_url: 'https://github.com/owner/repo/pull/10',
        },
        {
          number: 11,
          title: 'Draft PR',
          state: 'open',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          draft: true,
          merged_at: null,
          html_url: 'https://github.com/owner/repo/pull/11',
        },
        {
          number: 12,
          title: 'Merged PR',
          state: 'closed',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          draft: false,
          merged_at: '2026-01-02T00:00:00Z',
          html_url: 'https://github.com/owner/repo/pull/12',
        },
        {
          number: 13,
          title: 'Closed PR',
          state: 'closed',
          user: { login: 'dev' },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
          draft: false,
          merged_at: null,
          html_url: 'https://github.com/owner/repo/pull/13',
        },
      ])

      const plugin = createPlugin()
      const result = await plugin.tools.github_pull_requests.execute(
        { state: 'all', max: 10 },
        toolCtx,
      )
      expect(result).toContain('4 PR(s)')
      expect(result).toContain('🟢 Open')
      expect(result).toContain('📝 Draft')
      expect(result).toContain('🟣 Merged')
      expect(result).toContain('🔴 Closed')
    })

    it('returns empty message when no PRs', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      const result = await plugin.tools.github_pull_requests.execute(
        { state: 'open', max: 10 },
        toolCtx,
      )
      expect(result).toContain('No open pull requests')
    })
  })

  describe('github_repo_activity', () => {
    it('formats commits and releases', async () => {
      let callCount = 0
      fetchMock.mockImplementation(() => {
        callCount++
        const data =
          callCount === 1
            ? [
                {
                  sha: 'abc1234567890',
                  commit: {
                    message: 'feat: add new feature\n\nLong description',
                    author: { name: 'Alice', date: '2026-03-01T10:00:00Z' },
                  },
                },
              ]
            : [
                {
                  tag_name: 'v1.0.0',
                  name: 'First Release',
                  published_at: '2026-03-01T00:00:00Z',
                  prerelease: false,
                },
                {
                  tag_name: 'v1.1.0-beta',
                  name: 'Beta',
                  published_at: '2026-03-02T00:00:00Z',
                  prerelease: true,
                },
              ]
        return Promise.resolve(
          new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        )
      })

      const plugin = createPlugin()
      const result = await plugin.tools.github_repo_activity.execute(
        {},
        toolCtx,
      )
      expect(result).toContain('Recent commits')
      expect(result).toContain('abc1234') // truncated SHA
      expect(result).toContain('feat: add new feature') // first line only
      expect(result).not.toContain('Long description')
      expect(result).toContain('Alice')
      expect(result).toContain('Recent releases')
      expect(result).toContain('v1.0.0')
      expect(result).toContain('First Release')
      expect(result).toContain('(pre-release)')
    })

    it('handles empty activity', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      const result = await plugin.tools.github_repo_activity.execute(
        {},
        toolCtx,
      )
      expect(result).toContain('No recent activity')
    })
  })

  describe('github_mark_read', () => {
    it('returns success message on 205', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response(null, { status: 205 })),
      )

      const plugin = createPlugin()
      const result = await plugin.tools.github_mark_read.execute({}, toolCtx)
      expect(result).toContain('marked as read')
      expect(result).toContain('✅')
    })

    it('throws on API error', async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(new Response('forbidden', { status: 403 })),
      )

      const plugin = createPlugin()
      await expect(
        plugin.tools.github_mark_read.execute({}, toolCtx),
      ).rejects.toThrow(/403/)
    })
  })

  describe('API call structure', () => {
    it('sends correct auth headers', async () => {
      mockFetchResponse([])
      const plugin = createPlugin()
      await plugin.tools.github_notifications.execute(
        { filter: 'unread', max: 5 },
        toolCtx,
      )

      const [, opts] = fetchMock.mock.calls[0] as [string, RequestInit]
      const headers = opts.headers as Record<string, string>
      expect(headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
      expect(headers.Accept).toBe('application/vnd.github+json')
      expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
    })

    it('throws on non-ok response', async () => {
      mockFetchError(401, 'Bad credentials')
      const plugin = createPlugin()
      await expect(
        plugin.tools.github_notifications.execute(
          { filter: 'unread', max: 5 },
          toolCtx,
        ),
      ).rejects.toThrow(/401/)
    })
  })
})
