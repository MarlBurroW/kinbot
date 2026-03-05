import { z } from 'zod'
import { tool } from 'ai'
import type { ToolRegistration } from '@/server/tools/types'

// ─── Template definitions ───────────────────────────────────────────────────

export interface MiniAppTemplate {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  files: Record<string, string>
  suggestedSlug: string
}

const REACT_APP_JSON = JSON.stringify({
  dependencies: {
    'react': 'https://esm.sh/react@19',
    'react-dom/client': 'https://esm.sh/react-dom@19/client',
    '@kinbot/react': '/api/mini-apps/sdk/kinbot-react.js',
    '@kinbot/components': '/api/mini-apps/sdk/kinbot-components.js',
  },
}, null, 2)

const TEMPLATES: MiniAppTemplate[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'A rich analytics dashboard with interactive charts (LineChart, BarChart, PieChart, SparkLine), stats, tables, and activity feed. Showcases the full @kinbot/components library.',
    icon: '📊',
    tags: ['data', 'charts', 'statistics', 'components', 'analytics'],
    suggestedSlug: 'dashboard',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <style>
    body { padding: 1.5rem; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
    .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 768px) {
      .main-grid, .charts-grid { grid-template-columns: 1fr; }
    }
    .stat-spark { display: flex; align-items: center; gap: 0.75rem; }
    .stat-spark > :first-child { flex: 1; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot } from '@kinbot/react'
    import {
      Card, Stat, Badge, Table, List, ProgressBar, Tabs, Spinner, Stack,
      LineChart, BarChart, PieChart, SparkLine
    } from '@kinbot/components'

    // --- Data ---
    const revenueData = [
      { label: 'Jan', value: 12400, values: [12400, 8200] },
      { label: 'Feb', value: 15800, values: [15800, 9100] },
      { label: 'Mar', value: 14200, values: [14200, 11300] },
      { label: 'Apr', value: 18600, values: [18600, 10800] },
      { label: 'May', value: 22100, values: [22100, 14200] },
      { label: 'Jun', value: 19800, values: [19800, 12600] },
      { label: 'Jul', value: 24500, values: [24500, 15100] },
      { label: 'Aug', value: 28200, values: [28200, 16800] },
      { label: 'Sep', value: 26100, values: [26100, 18200] },
      { label: 'Oct', value: 31400, values: [31400, 19500] },
      { label: 'Nov', value: 35800, values: [35800, 21300] },
      { label: 'Dec', value: 48200, values: [48200, 24100] },
    ]

    const channelData = [
      { label: 'Organic', value: 42 },
      { label: 'Direct', value: 28 },
      { label: 'Referral', value: 18 },
      { label: 'Social', value: 12 },
    ]

    const weeklySignups = [
      { label: 'Mon', value: 34 },
      { label: 'Tue', value: 52 },
      { label: 'Wed', value: 41 },
      { label: 'Thu', value: 67 },
      { label: 'Fri', value: 55 },
      { label: 'Sat', value: 23 },
      { label: 'Sun', value: 18 },
    ]

    const stats = [
      { label: 'Total Users', value: '2,847', trend: '\\u2191 12.5%', trendUp: true, spark: [18, 22, 19, 25, 28, 24, 31, 35] },
      { label: 'Revenue', value: '$48.2k', trend: '\\u2191 8.1%', trendUp: true, spark: [12, 15, 14, 18, 22, 19, 24, 48] },
      { label: 'Active Now', value: '142', trend: '\\u2193 3.2%', trendUp: false, spark: [160, 155, 148, 152, 145, 142, 138, 142] },
      { label: 'Conversion', value: '3.6%', trend: '\\u2191 0.4%', trendUp: true, spark: [2.8, 3.0, 2.9, 3.1, 3.3, 3.2, 3.5, 3.6] },
    ]

    const tableColumns = [
      { key: 'name', label: 'Name' },
      { key: 'status', label: 'Status', render: (v) => <Badge variant={v === 'active' ? 'success' : v === 'pending' ? 'warning' : 'outline'}>{v}</Badge> },
      { key: 'revenue', label: 'Revenue', align: 'right' },
      { key: 'progress', label: 'Progress', render: (v) => <ProgressBar value={v} height={6} /> },
    ]

    const tableData = [
      { id: 1, name: 'Landing Page', status: 'active', revenue: '$12.4k', progress: 78 },
      { id: 2, name: 'Mobile App', status: 'active', revenue: '$8.1k', progress: 45 },
      { id: 3, name: 'API v2', status: 'pending', revenue: '$0', progress: 12 },
      { id: 4, name: 'Dashboard', status: 'active', revenue: '$24.8k', progress: 92 },
    ]

    const activities = [
      { id: '1', content: <Stack direction="row" align="center" justify="space-between"><span>New user signed up</span><Badge variant="outline">2m ago</Badge></Stack> },
      { id: '2', content: <Stack direction="row" align="center" justify="space-between"><span>Order #1234 completed</span><Badge variant="outline">15m ago</Badge></Stack> },
      { id: '3', content: <Stack direction="row" align="center" justify="space-between"><span>Report generated</span><Badge variant="outline">1h ago</Badge></Stack> },
      { id: '4', content: <Stack direction="row" align="center" justify="space-between"><span>Settings updated</span><Badge variant="outline">3h ago</Badge></Stack> },
    ]

    function App() {
      const { ready } = useKinBot()
      const [tab, setTab] = useState('overview')

      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>

      return (
        <div>
          <h2 className="gradient-primary-text" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>Dashboard</h2>

          <div className="stats-grid">
            {stats.map((s, i) => (
              <Card key={i} hover className={"animate-fade-in-up delay-" + i}>
                <Card.Content>
                  <div className="stat-spark">
                    <Stat value={s.value} label={s.label} trend={s.trend} trendUp={s.trendUp} />
                    <SparkLine data={s.spark} width={64} height={28} color={s.trendUp ? 'var(--color-success)' : 'var(--color-destructive)'} showArea />
                  </div>
                </Card.Content>
              </Card>
            ))}
          </div>

          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview', icon: '\\ud83d\\udcca' },
              { id: 'analytics', label: 'Analytics', icon: '\\ud83d\\udcc8' },
              { id: 'projects', label: 'Projects', icon: '\\ud83d\\udcc1' },
            ]}
            active={tab}
            onChange={setTab}
            style={{ marginBottom: '1rem' }}
          />

          {tab === 'overview' && (
            <div className="main-grid animate-fade-in">
              <Card>
                <Card.Header>
                  <Card.Title>Revenue Overview</Card.Title>
                  <Card.Description>Revenue vs. costs over the last 12 months</Card.Description>
                </Card.Header>
                <Card.Content>
                  <LineChart data={revenueData} series={['Revenue', 'Costs']} height={220} showDots showArea curved animate />
                </Card.Content>
              </Card>
              <Card>
                <Card.Header>
                  <Card.Title>Recent Activity</Card.Title>
                </Card.Header>
                <Card.Content>
                  <List items={activities} />
                </Card.Content>
              </Card>
            </div>
          )}

          {tab === 'analytics' && (
            <div className="charts-grid animate-fade-in">
              <Card>
                <Card.Header>
                  <Card.Title>Weekly Signups</Card.Title>
                  <Card.Description>New user registrations this week</Card.Description>
                </Card.Header>
                <Card.Content>
                  <BarChart data={weeklySignups} height={200} showValues showGrid animate />
                </Card.Content>
              </Card>
              <Card>
                <Card.Header>
                  <Card.Title>Traffic Sources</Card.Title>
                  <Card.Description>Breakdown by acquisition channel</Card.Description>
                </Card.Header>
                <Card.Content>
                  <PieChart data={channelData} height={200} donut showLabels showLegend animate />
                </Card.Content>
              </Card>
            </div>
          )}

          {tab === 'projects' && (
            <Card className="animate-fade-in">
              <Card.Header>
                <Card.Title>Active Projects</Card.Title>
                <Card.Description>Track progress across all projects</Card.Description>
              </Card.Header>
              <Card.Content style={{ padding: 0 }}>
                <Table columns={tableColumns} data={tableData} />
              </Card.Content>
            </Card>
          )}
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'todo-list',
    name: 'Todo List',
    description: 'A fully functional todo list with persistence via useStorage hook. Supports adding, completing, and deleting tasks.',
    icon: '✅',
    tags: ['productivity', 'storage', 'interactive'],
    suggestedSlug: 'todo-list',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo List</title>
  <style>
    body { padding: 1.5rem; max-width: 480px; margin: 0 auto; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .add-form { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
    .add-form input { flex: 1; }
    .todo-list { list-style: none; }
    .todo-item {
      display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem;
      border-radius: var(--radius-md); margin-bottom: 0.5rem; transition: opacity 0.2s;
    }
    .todo-item.done { opacity: 0.5; }
    .todo-item.done .todo-text { text-decoration: line-through; }
    .todo-text { flex: 1; font-size: 0.9rem; }
    .todo-check {
      width: 20px; height: 20px; border-radius: var(--radius-sm);
      border: 2px solid var(--color-border); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      background: transparent; color: var(--color-primary-foreground); transition: all 0.15s;
    }
    .todo-check.checked { background: var(--color-primary); border-color: var(--color-primary); }
    .todo-delete {
      background: none; border: none; cursor: pointer; color: var(--color-muted-foreground);
      font-size: 1.1rem; padding: 0 0.25rem; opacity: 0; transition: opacity 0.15s, color 0.15s;
    }
    .todo-item:hover .todo-delete { opacity: 1; }
    .todo-delete:hover { color: var(--color-destructive); }
    .empty-state { text-align: center; padding: 2rem; color: var(--color-muted-foreground); font-size: 0.9rem; }
    .counter { font-size: 0.75rem; color: var(--color-muted-foreground); margin-top: 1rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useStorage } from '@kinbot/react'

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div className="empty-state">Loading...</div>
      return <TodoApp />
    }

    function TodoApp() {
      const [todos, setTodos, loading] = useStorage('todos', [])
      const [input, setInput] = useState('')

      if (loading) return <div className="empty-state">Loading...</div>

      const remaining = todos.filter(t => !t.done).length

      const addTodo = () => {
        const text = input.trim()
        if (!text) return
        setTodos(prev => [{ text, done: false, id: Date.now() }, ...prev])
        setInput('')
      }

      const toggle = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))
      const remove = (id) => setTodos(prev => prev.filter(t => t.id !== id))

      return (
        <div>
          <h2 className="gradient-primary-text">Todo List</h2>
          <div className="add-form">
            <input className="input" value={input}
              onInput={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTodo()}
              placeholder="What needs to be done?" />
            <button className="btn btn-primary btn-shine" onClick={addTodo}>Add</button>
          </div>
          <ul className="todo-list">
            {todos.length === 0 ? (
              <li className="empty-state animate-fade-in">No tasks yet. Add one above!</li>
            ) : todos.map(t => (
              <li key={t.id} className={"todo-item surface-card animate-fade-in-up" + (t.done ? " done" : "")}>
                <button className={"todo-check" + (t.done ? " checked" : "")} onClick={() => toggle(t.id)}>
                  {t.done ? '\\u2713' : ''}
                </button>
                <span className="todo-text">{t.text}</span>
                <button className="todo-delete" onClick={() => remove(t.id)}>\\u00d7</button>
              </li>
            ))}
          </ul>
          {todos.length > 0 && <div className="counter">{remaining} of {todos.length} remaining</div>}
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'form',
    name: 'Form Builder',
    description: 'A contact form with client validation (useForm), async backend submission (useAsync), server-side validation, and submission history. Uses @kinbot/components (Card, Input, Select, Textarea, Checkbox, Switch, RadioGroup, DatePicker, Button, Alert, Divider, Stack, Badge, Table, Tabs, Spinner, EmptyState, Stat).',
    icon: '📝',
    tags: ['form', 'input', 'data-entry', 'components', 'validation', 'useForm', 'useAsync', 'backend'],
    suggestedSlug: 'form',
    files: {
      'app.json': REACT_APP_JSON,
      '_server.js': `// Backend: stores submissions in memory, validates server-side, returns history
const submissions = []

export default {
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'POST' && url.pathname === '/submit') {
      const body = await req.json()
      const errors = {}
      if (!body.firstName?.trim()) errors.firstName = 'First name is required'
      if (!body.lastName?.trim()) errors.lastName = 'Last name is required'
      if (!body.email?.trim()) errors.email = 'Email is required'
      else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(body.email)) errors.email = 'Invalid email format'
      if (!body.category) errors.category = 'Category is required'
      if (!body.agree) errors.agree = 'You must agree to the terms'
      // Simulate server-side duplicate check
      if (body.email && submissions.some(s => s.email === body.email)) {
        errors.email = 'This email has already been submitted'
      }
      if (Object.keys(errors).length > 0) {
        return Response.json({ ok: false, errors }, { status: 422 })
      }
      const record = { id: submissions.length + 1, ...body, submittedAt: new Date().toISOString() }
      submissions.push(record)
      return Response.json({ ok: true, record })
    }

    if (req.method === 'GET' && url.pathname === '/submissions') {
      return Response.json({ items: [...submissions].reverse(), total: submissions.length })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form</title>
  <style>
    body { padding: 1.5rem; max-width: 640px; margin: 0 auto; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }
    .server-error { font-size: 0.75rem; color: var(--color-destructive); margin-top: 0.25rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useCallback } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useForm, useAsync, useApi, toast } from '@kinbot/react'
    import { Card, Input, Select, Textarea, Checkbox, Switch, RadioGroup, DatePicker, Button, Alert, Divider, Stack, Badge, Table, Tabs, Spinner, EmptyState, Stat } from '@kinbot/components'

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      return <FormApp />
    }

    function FormApp() {
      const [tab, setTab] = useState('form')
      const history = useApi('/submissions')

      return (
        <div className="animate-fade-in-up">
          <Tabs value={tab} onChange={setTab} tabs={[
            { value: 'form', label: 'New Submission' },
            { value: 'history', label: <span>History {history.data?.total > 0 && <Badge size="sm" variant="secondary">{history.data.total}</Badge>}</span> },
          ]} />
          <div style={{ marginTop: '1rem' }}>
            {tab === 'form' ? (
              <RegistrationForm onSuccess={() => { history.refetch(); setTab('history') }} />
            ) : (
              <SubmissionHistory data={history.data} loading={history.loading} />
            )}
          </div>
        </div>
      )
    }

    function RegistrationForm({ onSuccess }) {
      const [serverErrors, setServerErrors] = useState({})

      const { run: submitToServer, loading: submitting, error: submitError } = useAsync(async (values) => {
        const res = await KinBot.api('/submit', { method: 'POST', body: values })
        if (!res.ok) {
          setServerErrors(res.errors || {})
          throw new Error('Server validation failed')
        }
        return res.record
      })

      const form = useForm(
        { firstName: '', lastName: '', email: '', category: '', birthDate: '', priority: 'normal', message: '', newsletter: false, agree: false },
        (v) => {
          const e = {}
          if (!v.firstName.trim()) e.firstName = 'First name is required'
          if (!v.lastName.trim()) e.lastName = 'Last name is required'
          if (!v.email.trim()) e.email = 'Email is required'
          else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v.email)) e.email = 'Enter a valid email'
          if (!v.category) e.category = 'Please select a category'
          if (!v.agree) e.agree = 'You must agree to continue'
          if (v.message && v.message.length > 500) e.message = v.message.length + '/500 characters'
          return e
        }
      )

      const onSubmit = form.handleSubmit(async (values) => {
        setServerErrors({})
        try {
          const record = await submitToServer(values)
          toast('Submission #' + record.id + ' saved!', 'success')
          form.reset()
          onSuccess?.()
        } catch {
          toast('Please fix the errors below', 'error')
        }
      })

      const fieldError = (name) => (form.touched[name] && form.errors[name]) || serverErrors[name]

      return (
        <Card>
          <Card.Header>
            <Card.Title className="gradient-primary-text">Contact Form</Card.Title>
            <Card.Description>Demonstrates useForm (client validation) + useAsync (async submission) with a backend that validates server-side.</Card.Description>
          </Card.Header>
          <Card.Content>
            {submitError && !Object.keys(serverErrors).length && (
              <Alert variant="error" title="Submission failed" style={{ marginBottom: '1rem' }}>
                An unexpected error occurred. Please try again.
              </Alert>
            )}
            <form onSubmit={onSubmit}>
              <Stack gap="1rem">
                <div className="form-row">
                  <Input label="First Name *" placeholder="John" value={form.values.firstName}
                    onChange={form.handleChange('firstName')} onBlur={form.handleBlur('firstName')}
                    error={fieldError('firstName')} disabled={submitting} />
                  <Input label="Last Name *" placeholder="Doe" value={form.values.lastName}
                    onChange={form.handleChange('lastName')} onBlur={form.handleBlur('lastName')}
                    error={fieldError('lastName')} disabled={submitting} />
                </div>
                <div>
                  <Input label="Email *" type="email" placeholder="john@example.com" value={form.values.email}
                    onChange={(v) => { form.handleChange('email')(v); setServerErrors(e => { const { email, ...rest } = e; return rest }) }}
                    onBlur={form.handleBlur('email')}
                    error={fieldError('email')} disabled={submitting} />
                  {serverErrors.email && !form.errors.email && <div className="server-error">⚠ Server: {serverErrors.email}</div>}
                </div>
                <div className="form-row">
                  <Select label="Category *" value={form.values.category}
                    onChange={form.handleChange('category')} onBlur={form.handleBlur('category')}
                    error={fieldError('category')} disabled={submitting}
                    options={[
                      { value: '', label: 'Select...' },
                      { value: 'general', label: 'General Inquiry' },
                      { value: 'support', label: 'Support' },
                      { value: 'feedback', label: 'Feedback' },
                      { value: 'partnership', label: 'Partnership' },
                    ]}
                  />
                  <DatePicker label="Birth Date" value={form.values.birthDate}
                    onChange={form.handleChange('birthDate')} disabled={submitting} />
                </div>
                <RadioGroup label="Priority" value={form.values.priority}
                  onChange={form.handleChange('priority')} direction="row" disabled={submitting}
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'high', label: 'High' },
                  ]}
                />
                <Textarea label="Message" placeholder="Tell us more..." value={form.values.message}
                  onChange={form.handleChange('message')} onBlur={form.handleBlur('message')}
                  error={fieldError('message')} disabled={submitting} />
                <Switch label="Subscribe to newsletter" checked={form.values.newsletter}
                  onChange={form.handleChange('newsletter')} disabled={submitting} />
                <Checkbox label="I agree to the terms and conditions *" checked={form.values.agree}
                  onChange={form.handleChange('agree')}
                  error={fieldError('agree')} disabled={submitting} />
                <Divider />
                <Stack direction="row" justify="space-between" align="center">
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-foreground)' }}>
                    {form.isDirty ? '● Unsaved changes' : ''}
                  </span>
                  <Stack direction="row" gap="0.75rem">
                    <Button type="button" variant="ghost" onClick={() => { form.reset(); setServerErrors({}) }}
                      disabled={!form.isDirty || submitting}>Reset</Button>
                    <Button type="submit" variant="shine" disabled={!form.isValid || submitting}
                      loading={submitting}>
                      {submitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </form>
          </Card.Content>
        </Card>
      )
    }

    function SubmissionHistory({ data, loading }) {
      if (loading) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      if (!data?.items?.length) return <EmptyState icon="📭" title="No submissions yet" description="Submit the form to see entries here." />

      const priorityVariant = { low: 'secondary', normal: 'default', high: 'destructive' }

      return (
        <Card>
          <Card.Header>
            <Stack direction="row" justify="space-between" align="center">
              <Card.Title>Submissions</Card.Title>
              <Stat value={data.total} label="total" size="sm" />
            </Stack>
          </Card.Header>
          <Card.Content>
            <Table
              columns={[
                { key: 'id', header: '#', width: '3rem' },
                { key: 'name', header: 'Name', render: (r) => r.firstName + ' ' + r.lastName },
                { key: 'email', header: 'Email' },
                { key: 'category', header: 'Category', render: (r) => <Badge size="sm">{r.category}</Badge> },
                { key: 'priority', header: 'Priority', render: (r) => <Badge size="sm" variant={priorityVariant[r.priority] || 'default'}>{r.priority}</Badge> },
                { key: 'submittedAt', header: 'Date', render: (r) => new Date(r.submittedAt).toLocaleString() },
              ]}
              data={data.items}
            />
          </Card.Content>
        </Card>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'data-viewer',
    name: 'Data Viewer',
    description: 'A searchable data table with pagination using @kinbot/components (Card, Table, Badge, Pagination, Input, Button, EmptyState).',
    icon: '🗂️',
    tags: ['table', 'data', 'search', 'components'],
    suggestedSlug: 'data-viewer',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Viewer</title>
  <style>
    body { padding: 1.5rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useMemo } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, toast, prompt } from '@kinbot/react'
    import { Card, Table, Badge, Pagination, Input, Button, ButtonGroup, EmptyState, Stack, Spinner } from '@kinbot/components'

    const INITIAL_DATA = [
      { id: 1, name: 'Alice Martin', email: 'alice@example.com', status: 'active' },
      { id: 2, name: 'Bob Chen', email: 'bob@example.com', status: 'inactive' },
      { id: 3, name: 'Claire Dubois', email: 'claire@example.com', status: 'active' },
      { id: 4, name: 'David Kim', email: 'david@example.com', status: 'pending' },
      { id: 5, name: 'Emma Wilson', email: 'emma@example.com', status: 'active' },
      { id: 6, name: 'Fabien Roux', email: 'fabien@example.com', status: 'active' },
      { id: 7, name: 'Grace Lee', email: 'grace@example.com', status: 'inactive' },
      { id: 8, name: 'Hugo Bernard', email: 'hugo@example.com', status: 'pending' },
    ]

    const PER_PAGE = 5

    const STATUS_VARIANTS = { active: 'success', pending: 'warning', inactive: 'outline' }

    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'status', label: 'Status', render: (v) => <Badge variant={STATUS_VARIANTS[v] || 'outline'}>{v}</Badge> },
      { key: 'actions', label: 'Actions', render: (_, row) => <Button variant="ghost" size="sm" onClick={() => toast('Edit ' + row.name, 'info')}>Edit</Button> },
    ]

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      return <DataViewer />
    }

    function DataViewer() {
      const [data, setData] = useState(INITIAL_DATA)
      const [search, setSearch] = useState('')
      const [page, setPage] = useState(1)

      const filtered = useMemo(() => {
        if (!search) return data
        const q = search.toLowerCase()
        return data.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.status.includes(q))
      }, [data, search])

      const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
      const safePage = Math.min(page, totalPages)
      const slice = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)

      const addEntry = async () => {
        const name = await prompt('Enter name:', { title: 'Add Entry' })
        if (!name) return
        const email = await prompt('Enter email:', { title: 'Add Entry' })
        if (!email) return
        setData(prev => [...prev, { id: Date.now(), name, email, status: 'active' }])
        toast('Entry added', 'success')
      }

      return (
        <Stack gap="1rem" className="animate-fade-in-up">
          <h2 className="gradient-primary-text" style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Data Viewer</h2>

          <Stack direction="row" gap="0.75rem" align="center">
            <Input
              placeholder="Search..."
              value={search}
              onInput={e => { setSearch(e.target.value); setPage(1) }}
              style={{ flex: 1 }}
            />
            <Button variant="shine" size="sm" onClick={addEntry}>+ Add</Button>
          </Stack>

          <Card>
            <Card.Content style={{ padding: 0 }}>
              {slice.length === 0 ? (
                <EmptyState icon="\\ud83d\\udd0d" title="No results found" description="Try a different search term." />
              ) : (
                <Table columns={columns} data={slice} />
              )}
            </Card.Content>
            {filtered.length > PER_PAGE && (
              <Card.Footer style={{ justifyContent: 'center' }}>
                <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
              </Card.Footer>
            )}
          </Card>

          <div style={{ fontSize: '0.8rem', color: 'var(--color-muted-foreground)' }}>
            {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'} total
          </div>
        </Stack>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'kanban',
    name: 'Kanban Board',
    description: 'A drag-and-drop kanban board with columns and cards. Uses storage for persistence. Great for project management or task tracking.',
    icon: '📋',
    tags: ['kanban', 'drag-drop', 'project-management', 'storage'],
    suggestedSlug: 'kanban',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban Board</title>
  <style>
    body { padding: 1rem; overflow-x: auto; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .board { display: flex; gap: 1rem; min-height: 400px; align-items: flex-start; }
    .column { min-width: 220px; max-width: 280px; flex: 1; border-radius: var(--radius-lg); padding: 0.75rem; }
    .column-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.75rem; padding: 0 0.25rem;
    }
    .column-title { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted-foreground); }
    .column-count { font-size: 0.7rem; padding: 0.125rem 0.5rem; border-radius: var(--radius-full); background: var(--color-muted); color: var(--color-muted-foreground); }
    .card-list { min-height: 60px; display: flex; flex-direction: column; gap: 0.5rem; }
    .card-list.drag-over { outline: 2px dashed var(--color-primary); outline-offset: -2px; border-radius: var(--radius-md); }
    .kanban-card {
      padding: 0.75rem; border-radius: var(--radius-md); cursor: grab; font-size: 0.85rem;
      transition: box-shadow 0.15s, transform 0.15s;
    }
    .kanban-card:active { cursor: grabbing; }
    .kanban-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .kanban-card.dragging { opacity: 0.4; }
    .card-title { font-weight: 500; margin-bottom: 0.25rem; }
    .card-tags { display: flex; gap: 0.25rem; margin-top: 0.375rem; }
    .card-tag { font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: var(--radius-full); background: var(--color-secondary); color: var(--color-secondary-foreground); }
    .add-card-btn { width: 100%; margin-top: 0.25rem; border-style: dashed; color: var(--color-muted-foreground); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useRef } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useStorage, prompt } from '@kinbot/react'

    const DEFAULT_BOARD = {
      columns: [
        { id: 'todo', title: 'To Do', cards: [
          { id: '1', title: 'Design landing page', tags: ['design'] },
          { id: '2', title: 'Write API docs', tags: ['docs'] },
        ]},
        { id: 'progress', title: 'In Progress', cards: [
          { id: '3', title: 'Implement auth flow', tags: ['backend', 'priority'] },
        ]},
        { id: 'done', title: 'Done', cards: [
          { id: '4', title: 'Set up CI/CD', tags: ['devops'] },
        ]},
      ],
    }

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>
      return <KanbanBoard />
    }

    function KanbanBoard() {
      const [board, setBoard, loading] = useStorage('board', DEFAULT_BOARD)
      const dragRef = useRef(null)

      if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>

      const moveCard = (cardId, fromColId, toColId) => {
        if (fromColId === toColId) return
        setBoard(prev => {
          const cols = prev.columns.map(c => ({ ...c, cards: [...c.cards] }))
          const fromCol = cols.find(c => c.id === fromColId)
          const toCol = cols.find(c => c.id === toColId)
          if (!fromCol || !toCol) return prev
          const idx = fromCol.cards.findIndex(c => c.id === cardId)
          if (idx === -1) return prev
          const [card] = fromCol.cards.splice(idx, 1)
          toCol.cards.push(card)
          return { ...prev, columns: cols }
        })
      }

      const addCard = async (colId) => {
        const title = await prompt('Card title:', { title: 'New Card' })
        if (!title) return
        setBoard(prev => ({
          ...prev,
          columns: prev.columns.map(c =>
            c.id === colId ? { ...c, cards: [...c.cards, { id: String(Date.now()), title, tags: [] }] } : c
          ),
        }))
      }

      const handleDragStart = (e, cardId, colId) => {
        dragRef.current = { cardId, fromCol: colId }
        e.currentTarget.classList.add('dragging')
        e.dataTransfer.effectAllowed = 'move'
      }

      const handleDragEnd = (e) => {
        e.currentTarget.classList.remove('dragging')
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'))
      }

      const handleDragOver = (e) => {
        e.preventDefault()
        e.currentTarget.classList.add('drag-over')
      }

      const handleDragLeave = (e) => e.currentTarget.classList.remove('drag-over')

      const handleDrop = (e, toColId) => {
        e.preventDefault()
        e.currentTarget.classList.remove('drag-over')
        if (!dragRef.current) return
        moveCard(dragRef.current.cardId, dragRef.current.fromCol, toColId)
        dragRef.current = null
      }

      return (
        <div>
          <h2 className="gradient-primary-text">Kanban Board</h2>
          <div className="board">
            {board.columns.map(col => (
              <div key={col.id} className="column glass-strong animate-fade-in-up">
                <div className="column-header">
                  <span className="column-title">{col.title}</span>
                  <span className="column-count">{col.cards.length}</span>
                </div>
                <div className="card-list"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, col.id)}>
                  {col.cards.map(card => (
                    <div key={card.id} className="kanban-card surface-card" draggable
                      onDragStart={e => handleDragStart(e, card.id, col.id)}
                      onDragEnd={handleDragEnd}>
                      <div className="card-title">{card.title}</div>
                      {card.tags.length > 0 && (
                        <div className="card-tags">
                          {card.tags.map(t => <span key={t} className="card-tag">{t}</span>)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button className="btn btn-ghost btn-sm add-card-btn" onClick={() => addCard(col.id)}>+ Add card</button>
              </div>
            ))}
          </div>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'chat',
    name: 'Chat Interface',
    description: 'A conversational chat interface that uses KinBot.sendMessage() to talk to the Kin and KinBot.memory to search/store memories. Great for building custom chat experiences or knowledge assistants.',
    icon: '💬',
    tags: ['chat', 'messaging', 'memory', 'conversational'],
    suggestedSlug: 'chat',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .chat-header { padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: 0.75rem; }
    .chat-header h2 { font-size: 1rem; font-weight: 600; margin: 0; }
    .chat-header .subtitle { font-size: 0.75rem; color: var(--color-muted-foreground); }
    .messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .message { max-width: 80%; padding: 0.625rem 0.875rem; border-radius: var(--radius-lg); font-size: 0.875rem; line-height: 1.5; animation: msg-in 0.2s ease-out; }
    .message.user { align-self: flex-end; background: var(--color-primary); color: var(--color-primary-foreground); border-bottom-right-radius: var(--radius-sm); }
    .message.bot { align-self: flex-start; border-bottom-left-radius: var(--radius-sm); }
    .message .time { font-size: 0.65rem; opacity: 0.6; margin-top: 0.25rem; }
    .typing { align-self: flex-start; padding: 0.75rem 1rem; font-size: 0.8rem; color: var(--color-muted-foreground); font-style: italic; }
    .input-bar { padding: 0.75rem 1rem; border-top: 1px solid var(--color-border); display: flex; gap: 0.5rem; }
    .input-bar input { flex: 1; padding: 0.5rem 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--color-border); background: var(--color-input); color: var(--color-foreground); font-size: 0.875rem; outline: none; }
    .input-bar input:focus { border-color: var(--color-ring); box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-ring) 25%, transparent); }
    .memory-results { padding: 0.5rem 1rem; max-height: 120px; overflow-y: auto; border-top: 1px solid var(--color-border); }
    .memory-item { font-size: 0.75rem; padding: 0.25rem 0; color: var(--color-muted-foreground); border-bottom: 1px solid var(--color-border); }
    .memory-item:last-child { border-bottom: none; }
    @keyframes msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useRef, useEffect } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useStorage, toast } from '@kinbot/react'
    import { Button, Badge, Spinner } from '@kinbot/components'

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div style={{ padding: '2rem', textAlign: 'center' }}><Spinner size="lg" /></div>
      return <ChatApp />
    }

    function ChatApp() {
      const [messages, setMessages, loading] = useStorage('chat-messages', [])
      const [input, setInput] = useState('')
      const [sending, setSending] = useState(false)
      const [memories, setMemories] = useState(null)
      const endRef = useRef(null)

      useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

      const send = async () => {
        const text = input.trim()
        if (!text || sending) return
        setInput('')
        const userMsg = { role: 'user', text, time: Date.now() }
        setMessages(prev => [...prev, userMsg])
        setSending(true)
        try {
          const reply = await KinBot.sendMessage(text)
          setMessages(prev => [...prev, { role: 'bot', text: reply?.text || reply || 'No response', time: Date.now() }])
        } catch (err) {
          toast('Failed to send message', 'error')
        }
        setSending(false)
      }

      const searchMemory = async () => {
        const q = input.trim()
        if (!q) return
        try {
          const results = await KinBot.memory.search(q, 5)
          setMemories(results)
        } catch { toast('Memory search failed', 'error') }
      }

      const fmt = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <div className="chat-header glass-strong">
            <Badge variant="primary">💬</Badge>
            <div>
              <h2>Chat</h2>
              <div className="subtitle">{messages.length} messages</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <Button size="sm" variant="ghost" onClick={searchMemory} title="Search memories">🔍</Button>
              <Button size="sm" variant="ghost" onClick={() => { setMessages([]); setMemories(null) }} title="Clear">🗑️</Button>
            </div>
          </div>

          <div className="messages">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--color-muted-foreground)', padding: '3rem 1rem', fontSize: '0.875rem' }}>
                Start a conversation. Type a message below.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={"message " + m.role + (m.role === 'bot' ? ' surface-card' : '')}>
                <div>{m.text}</div>
                <div className="time">{fmt(m.time)}</div>
              </div>
            ))}
            {sending && <div className="typing">Thinking...</div>}
            <div ref={endRef} />
          </div>

          {memories && memories.length > 0 && (
            <div className="memory-results glass-subtle">
              <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-muted-foreground)', marginBottom: '0.25rem' }}>🧠 Memory results</div>
              {memories.map((m, i) => <div key={i} className="memory-item">{m.content}</div>)}
              <Button size="sm" variant="ghost" onClick={() => setMemories(null)} style={{ marginTop: '0.25rem', width: '100%' }}>Close</Button>
            </div>
          )}

          <div className="input-bar glass-strong">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Type a message..."
              disabled={sending}
            />
            <Button onClick={send} disabled={sending || !input.trim()}>Send</Button>
          </div>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'settings',
    name: 'Settings Panel',
    description: 'A settings/preferences panel using Panel (collapsible sections), Switch, Select, RadioGroup, Slider, and Input components with storage persistence.',
    icon: '⚙️',
    tags: ['settings', 'form', 'preferences', 'config', 'storage', 'panel', 'slider', 'radiogroup'],
    suggestedSlug: 'settings',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Settings</title>
  <style>
    body { padding: 1.5rem; max-width: 640px; margin: 0 auto; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.25rem; }
    .subtitle { font-size: 0.85rem; color: var(--color-muted-foreground); margin-bottom: 1.5rem; }
    .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; }
    .setting-info { flex: 1; min-width: 0; }
    .setting-label { font-size: 0.875rem; font-weight: 500; }
    .setting-desc { font-size: 0.75rem; color: var(--color-muted-foreground); margin-top: 0.125rem; }
    .setting-control { flex-shrink: 0; margin-left: 1rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useStorage, toast } from '@kinbot/react'
    import { Panel, Switch, Select, RadioGroup, Slider, Input, Button, Badge, Stack, Spinner, Divider } from '@kinbot/components'

    const DEFAULTS = {
      theme: 'auto',
      fontSize: 14,
      uiDensity: 'comfortable',
      notifications: true,
      soundEffects: true,
      notifyFrequency: 'all',
      displayName: '',
      language: 'en',
      autoSave: true,
    }

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      return <SettingsPanel />
    }

    function Setting({ label, desc, children }) {
      return (
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">{label}</div>
            {desc && <div className="setting-desc">{desc}</div>}
          </div>
          <div className="setting-control">{children}</div>
        </div>
      )
    }

    function SettingsPanel() {
      const [settings, setSettings, loading] = useStorage('app-settings', DEFAULTS)
      const [dirty, setDirty] = useState(false)

      if (loading) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>

      const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }))
        setDirty(true)
      }

      const save = () => {
        setDirty(false)
        toast('Settings saved!', 'success')
      }

      const reset = () => {
        setSettings(DEFAULTS)
        setDirty(true)
        toast('Reset to defaults', 'info')
      }

      return (
        <div className="animate-fade-in-up">
          <Stack direction="row" align="center" gap="0.75rem" style={{ marginBottom: '0.25rem' }}>
            <h2 className="gradient-primary-text">Settings</h2>
            {dirty && <Badge variant="warning">Unsaved</Badge>}
          </Stack>
          <div className="subtitle">Configure your app preferences</div>

          <Stack gap="0.75rem">
            <Panel title="Appearance" icon="🎨" defaultOpen>
              <Setting label="Theme" desc="Choose your preferred color scheme">
                <RadioGroup value={settings.theme} onChange={(e) => update('theme', e.target.value)} direction="row"
                  options={[
                    { value: 'auto', label: 'Auto' },
                    { value: 'light', label: 'Light' },
                    { value: 'dark', label: 'Dark' },
                  ]}
                />
              </Setting>
              <Setting label="Font Size" desc={settings.fontSize + 'px'}>
                <Slider value={settings.fontSize} onChange={(e) => update('fontSize', Number(e.target.value))}
                  min={10} max={22} step={1} style={{ width: 160 }} />
              </Setting>
              <Setting label="UI Density" desc="Controls spacing and padding">
                <Select value={settings.uiDensity} onChange={(e) => update('uiDensity', e.target.value)} style={{ width: 140 }}
                  options={[
                    { value: 'compact', label: 'Compact' },
                    { value: 'comfortable', label: 'Comfortable' },
                    { value: 'spacious', label: 'Spacious' },
                  ]}
                />
              </Setting>
            </Panel>

            <Panel title="Notifications" icon="🔔" defaultOpen>
              <Setting label="Push Notifications" desc="Receive alerts for important updates">
                <Switch checked={settings.notifications} onChange={(e) => update('notifications', e.target.checked)} />
              </Setting>
              <Setting label="Sound Effects" desc="Play sounds for interactions">
                <Switch checked={settings.soundEffects} onChange={(e) => update('soundEffects', e.target.checked)} />
              </Setting>
              {settings.notifications && (
                <Setting label="Frequency" desc="How often to receive notifications">
                  <RadioGroup value={settings.notifyFrequency} onChange={(e) => update('notifyFrequency', e.target.value)} direction="row"
                    options={[
                      { value: 'all', label: 'All' },
                      { value: 'important', label: 'Important' },
                      { value: 'none', label: 'None' },
                    ]}
                  />
                </Setting>
              )}
            </Panel>

            <Panel title="Profile" icon="👤">
              <Setting label="Display Name" desc="How others see you">
                <Input value={settings.displayName} onChange={(e) => update('displayName', e.target.value)}
                  placeholder="Enter name" style={{ width: 180 }} />
              </Setting>
              <Setting label="Language" desc="Interface language">
                <Select value={settings.language} onChange={(e) => update('language', e.target.value)} style={{ width: 140 }}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'fr', label: 'Français' },
                    { value: 'de', label: 'Deutsch' },
                    { value: 'es', label: 'Español' },
                    { value: 'ja', label: '日本語' },
                  ]}
                />
              </Setting>
              <Setting label="Auto-Save" desc="Automatically save changes">
                <Switch checked={settings.autoSave} onChange={(e) => update('autoSave', e.target.checked)} />
              </Setting>
            </Panel>
          </Stack>

          <Divider style={{ margin: '1.25rem 0' }} />
          <Stack direction="row" gap="0.75rem" justify="flex-end">
            <Button variant="outline" onClick={reset}>Reset to Defaults</Button>
            <Button onClick={save} disabled={!dirty}>Save Changes</Button>
          </Stack>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'wizard',
    name: 'Multi-Step Wizard',
    description: 'A multi-step wizard form using Stepper, StepperContent, useForm, and storage persistence. Demonstrates step navigation, validation per step, and final review.',
    icon: '🧙',
    tags: ['wizard', 'stepper', 'multi-step', 'form', 'validation', 'useForm'],
    suggestedSlug: 'wizard',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wizard</title>
  <style>
    body { padding: 1.5rem; max-width: 600px; margin: 0 auto; }
    .review-row { display: flex; justify-content: space-between; padding: 0.4rem 0; font-size: 0.875rem; }
    .review-label { color: var(--color-muted-foreground); }
    .review-value { font-weight: 500; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useForm, useStorage, toast } from '@kinbot/react'
    import { Card, Input, Select, Textarea, Switch, RadioGroup, Button, Alert, Divider, Stack, Spinner, Stepper, StepperContent, Badge } from '@kinbot/components'

    const STEPS = [
      { label: 'Account', icon: '👤' },
      { label: 'Details', icon: '📋' },
      { label: 'Preferences', icon: '⚙️' },
      { label: 'Review', icon: '✅' },
    ]

    const INITIAL = {
      email: '', password: '', confirmPassword: '',
      fullName: '', company: '', role: '', bio: '',
      plan: 'free', notifications: true, newsletter: false,
    }

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      return <WizardForm />
    }

    function WizardForm() {
      const [step, setStep] = useState(0)
      const [submitted, setSubmitted] = useState(false)
      const [savedDraft, setSavedDraft, draftLoading] = useStorage('wizard-draft', null)

      const form = useForm(savedDraft || INITIAL, (v) => {
        const e = {}
        if (!v.email.trim()) e.email = 'Required'
        else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v.email)) e.email = 'Invalid email'
        if (!v.password || v.password.length < 6) e.password = 'Min 6 characters'
        if (v.password !== v.confirmPassword) e.confirmPassword = 'Passwords must match'
        if (!v.fullName.trim()) e.fullName = 'Required'
        if (!v.role) e.role = 'Please select a role'
        return e
      })

      if (draftLoading) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>

      const stepErrors = [
        ['email', 'password', 'confirmPassword'],
        ['fullName', 'role'],
        [],
        [],
      ]

      const canProceed = () => {
        const fields = stepErrors[step]
        for (const f of fields) {
          if (form.errors[f]) return false
          if (!form.values[f] && f !== 'confirmPassword') return false
        }
        if (step === 0 && form.values.password !== form.values.confirmPassword) return false
        return true
      }

      const next = () => {
        stepErrors[step].forEach(f => form.handleBlur(f)())
        if (canProceed()) {
          setSavedDraft(form.values)
          setStep(s => Math.min(s + 1, STEPS.length - 1))
        }
      }

      const back = () => setStep(s => Math.max(s - 1, 0))

      const submit = () => {
        toast('Account created successfully!', 'success')
        setSavedDraft(null)
        setSubmitted(true)
      }

      if (submitted) {
        return (
          <Card className="animate-scale-in">
            <Card.Content>
              <Stack align="center" gap="1rem" style={{ padding: '2rem 0' }}>
                <div style={{ fontSize: '3rem' }}>🎉</div>
                <h2 className="gradient-primary-text" style={{ margin: 0 }}>Welcome aboard!</h2>
                <p style={{ color: 'var(--color-muted-foreground)', textAlign: 'center' }}>
                  Your account has been created. Check your email for verification.
                </p>
                <Button onClick={() => { form.reset(); setStep(0); setSubmitted(false) }}>Start Over</Button>
              </Stack>
            </Card.Content>
          </Card>
        )
      }

      return (
        <div className="animate-fade-in-up">
          <Stepper steps={STEPS} activeStep={step} onStepClick={setStep} />
          <Card style={{ marginTop: '1.25rem' }}>
            <Card.Content>
              <StepperContent activeStep={step}>
                {/* Step 0: Account */}
                <Stack gap="1rem">
                  <h3 style={{ margin: 0 }}>Create your account</h3>
                  <Input label="Email *" type="email" placeholder="you@example.com"
                    value={form.values.email} onChange={form.handleChange('email')}
                    onBlur={form.handleBlur('email')} error={form.touched.email && form.errors.email} />
                  <Input label="Password *" type="password" placeholder="Min 6 characters"
                    value={form.values.password} onChange={form.handleChange('password')}
                    onBlur={form.handleBlur('password')} error={form.touched.password && form.errors.password} />
                  <Input label="Confirm Password *" type="password" placeholder="Re-enter password"
                    value={form.values.confirmPassword} onChange={form.handleChange('confirmPassword')}
                    onBlur={form.handleBlur('confirmPassword')} error={form.touched.confirmPassword && form.errors.confirmPassword} />
                </Stack>

                {/* Step 1: Details */}
                <Stack gap="1rem">
                  <h3 style={{ margin: 0 }}>Tell us about yourself</h3>
                  <Input label="Full Name *" placeholder="John Doe"
                    value={form.values.fullName} onChange={form.handleChange('fullName')}
                    onBlur={form.handleBlur('fullName')} error={form.touched.fullName && form.errors.fullName} />
                  <Input label="Company" placeholder="Acme Inc."
                    value={form.values.company} onChange={form.handleChange('company')} />
                  <Select label="Role *" value={form.values.role}
                    onChange={form.handleChange('role')} onBlur={form.handleBlur('role')}
                    error={form.touched.role && form.errors.role}
                    options={[
                      { value: '', label: 'Select your role...' },
                      { value: 'developer', label: 'Developer' },
                      { value: 'designer', label: 'Designer' },
                      { value: 'manager', label: 'Manager' },
                      { value: 'other', label: 'Other' },
                    ]} />
                  <Textarea label="Bio" placeholder="Tell us a bit about yourself..."
                    value={form.values.bio} onChange={form.handleChange('bio')} />
                </Stack>

                {/* Step 2: Preferences */}
                <Stack gap="1rem">
                  <h3 style={{ margin: 0 }}>Your preferences</h3>
                  <RadioGroup label="Plan" value={form.values.plan}
                    onChange={form.handleChange('plan')}
                    options={[
                      { value: 'free', label: 'Free' },
                      { value: 'pro', label: 'Pro ($9/mo)' },
                      { value: 'enterprise', label: 'Enterprise ($49/mo)' },
                    ]} />
                  <Divider />
                  <Switch label="Enable notifications" checked={form.values.notifications}
                    onChange={form.handleChange('notifications')} />
                  <Switch label="Subscribe to newsletter" checked={form.values.newsletter}
                    onChange={form.handleChange('newsletter')} />
                </Stack>

                {/* Step 3: Review */}
                <Stack gap="0.75rem">
                  <h3 style={{ margin: 0 }}>Review your information</h3>
                  <div className="surface-card" style={{ padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                    <div className="review-row"><span className="review-label">Email</span><span className="review-value">{form.values.email}</span></div>
                    <div className="review-row"><span className="review-label">Name</span><span className="review-value">{form.values.fullName}</span></div>
                    {form.values.company && <div className="review-row"><span className="review-label">Company</span><span className="review-value">{form.values.company}</span></div>}
                    <div className="review-row"><span className="review-label">Role</span><span className="review-value">{form.values.role}</span></div>
                    <div className="review-row"><span className="review-label">Plan</span><Badge>{form.values.plan}</Badge></div>
                    <div className="review-row"><span className="review-label">Notifications</span><span className="review-value">{form.values.notifications ? '✓' : '✗'}</span></div>
                  </div>
                  {form.values.bio && (
                    <>
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-muted-foreground)', fontWeight: 500 }}>Bio</div>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>{form.values.bio}</p>
                    </>
                  )}
                </Stack>
              </StepperContent>

              <Divider style={{ margin: '1.25rem 0' }} />
              <Stack direction="row" justify="space-between">
                <Button variant="ghost" onClick={back} disabled={step === 0}>← Back</Button>
                {step < STEPS.length - 1
                  ? <Button onClick={next} disabled={!canProceed()}>Next →</Button>
                  : <Button variant="shine" onClick={submit}>Create Account</Button>
                }
              </Stack>
            </Card.Content>
          </Card>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'api-explorer',
    name: 'API Explorer',
    description: 'An interactive API explorer demonstrating all data-fetching hooks: useFetch for external APIs, useApi for backend calls, useAsync for mutations, and useEventStream for real-time updates. Includes a live request builder and response viewer.',
    icon: '🔌',
    tags: ['api', 'fetch', 'backend', 'hooks', 'useFetch', 'useApi', 'useAsync', 'useEventStream', 'data'],
    suggestedSlug: 'api-explorer',
    files: {
      'app.json': REACT_APP_JSON,
      '_server.js': `// Backend API for the API Explorer demo
export default {
  // GET /api/mini-apps/:id/api/status — server status
  'GET /status': async (req) => {
    return Response.json({
      status: 'online',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      memoryMB: Math.round(process.memoryUsage?.().heapUsed / 1024 / 1024) || 0,
    })
  },

  // GET /api/mini-apps/:id/api/items — list items
  'GET /items': async (req) => {
    const items = [
      { id: 1, name: 'Alpha', category: 'core', score: 92 },
      { id: 2, name: 'Beta', category: 'plugin', score: 78 },
      { id: 3, name: 'Gamma', category: 'core', score: 85 },
      { id: 4, name: 'Delta', category: 'plugin', score: 64 },
      { id: 5, name: 'Epsilon', category: 'core', score: 97 },
    ]
    return Response.json({ items, total: items.length })
  },

  // POST /api/mini-apps/:id/api/echo — echo back posted data
  'POST /echo': async (req) => {
    const body = await req.json().catch(() => ({}))
    return Response.json({
      received: body,
      echoedAt: new Date().toISOString(),
      headers: Object.fromEntries([...req.headers.entries()].filter(([k]) => !k.startsWith('x-') && k !== 'cookie')),
    })
  },

  // SSE /api/mini-apps/:id/api/events/tick — real-time tick stream
  'GET /events/tick': async (req) => {
    let count = 0
    const stream = new ReadableStream({
      start(controller) {
        const iv = setInterval(() => {
          count++
          const data = JSON.stringify({ count, ts: Date.now() })
          controller.enqueue(\`event: tick\\ndata: \${data}\\n\\n\`)
          if (count >= 50) { clearInterval(iv); controller.close() }
        }, 2000)
        req.signal?.addEventListener('abort', () => { clearInterval(iv); controller.close() })
      },
    })
    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    })
  },
}
`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Explorer</title>
  <style>
    body { padding: 1.5rem; max-width: 800px; margin: 0 auto; }
    pre.response { background: var(--color-muted); border-radius: var(--radius-md);
      padding: 1rem; font-size: 0.8rem; overflow-x: auto; max-height: 300px;
      color: var(--color-foreground); white-space: pre-wrap; word-break: break-word; }
    .section { margin-bottom: 2rem; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      margin-right: 6px; vertical-align: middle; }
    .status-dot.online { background: var(--color-success, #22c55e); }
    .status-dot.offline { background: var(--color-destructive, #ef4444); }
    .event-log { max-height: 200px; overflow-y: auto; font-size: 0.8rem; }
    .event-item { padding: 0.25rem 0.5rem; border-bottom: 1px solid var(--color-border); }
    .event-item:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useCallback } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useApi, useFetch, useAsync, useEventStream, toast } from '@kinbot/react'
    import { Card, Tabs, Badge, Button, Input, Textarea, Stack, Spinner, Divider, Alert, Stat, Select } from '@kinbot/components'

    // ── Tab 1: Backend API (useApi) ──
    function BackendTab() {
      const status = useApi('/status')
      const items = useApi('/items')

      return (
        <Stack gap="1.5rem">
          <Card title="Server Status" subtitle="useApi('/status') — auto-fetches on mount">
            {status.loading ? <Spinner /> : status.error ? (
              <Alert variant="destructive">{status.error.message}</Alert>
            ) : status.data && (
              <Stack direction="row" gap="1rem" style={{ flexWrap: 'wrap' }}>
                <Stat label="Status" value={<><span className={"status-dot " + status.data.status} />{status.data.status}</>} />
                <Stat label="Uptime" value={status.data.uptime + 's'} />
                <Stat label="Memory" value={status.data.memoryMB + ' MB'} />
              </Stack>
            )}
            <div style={{ marginTop: '0.75rem' }}>
              <Button size="sm" variant="outline" onClick={() => status.refetch()}>Refresh</Button>
            </div>
          </Card>

          <Card title="Items List" subtitle="useApi('/items')">
            {items.loading ? <Spinner /> : items.error ? (
              <Alert variant="destructive">{items.error.message}</Alert>
            ) : items.data && (
              <>
                <Badge variant="outline">{items.data.total} items</Badge>
                <div style={{ marginTop: '0.75rem' }}>
                  {items.data.items.map(item => (
                    <div key={item.id} className="event-item">
                      <Stack direction="row" justify="space-between" align="center">
                        <span><strong>{item.name}</strong> <Badge size="sm">{item.category}</Badge></span>
                        <span style={{ color: 'var(--color-muted-foreground)' }}>Score: {item.score}</span>
                      </Stack>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </Stack>
      )
    }

    // ── Tab 2: External Fetch (useFetch) ──
    function FetchTab() {
      const [url, setUrl] = useState('https://httpbin.org/json')
      const [fetchUrl, setFetchUrl] = useState(url)
      const result = useFetch(fetchUrl)

      return (
        <Stack gap="1.5rem">
          <Card title="External API" subtitle="useFetch(url) — proxied through KinBot.http()">
            <Stack direction="row" gap="0.5rem" align="end">
              <div style={{ flex: 1 }}>
                <Input label="URL" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://api.example.com/data" />
              </div>
              <Button onClick={() => setFetchUrl(url)}>Fetch</Button>
            </Stack>
          </Card>

          <Card title="Response" subtitle={result.loading ? 'Loading...' : result.error ? 'Error' : \`Status: \${result.status || 'OK'}\`}>
            {result.loading ? <Spinner /> : result.error ? (
              <Alert variant="destructive">{result.error.message}</Alert>
            ) : (
              <pre className="response">{JSON.stringify(result.data, null, 2)}</pre>
            )}
          </Card>
        </Stack>
      )
    }

    // ── Tab 3: Mutations (useAsync) ──
    function MutationTab() {
      const [payload, setPayload] = useState(JSON.stringify({ message: 'Hello!', n: 42 }, null, 2))
      const echo = useAsync(async (body) => {
        const res = await window.KinBot.api('/echo', { method: 'POST', body })
        return res
      })

      const handleSend = useCallback(() => {
        try {
          const parsed = JSON.parse(payload)
          echo.run(parsed)
        } catch (e) {
          toast('Invalid JSON', 'error')
        }
      }, [payload])

      return (
        <Stack gap="1.5rem">
          <Card title="POST Echo" subtitle="useAsync(fn) — manual trigger, tracks loading/error">
            <Textarea label="JSON Payload" value={payload} onChange={e => setPayload(e.target.value)}
              rows={5} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }} />
            <div style={{ marginTop: '0.75rem' }}>
              <Stack direction="row" gap="0.5rem">
                <Button onClick={handleSend} disabled={echo.loading}>
                  {echo.loading ? 'Sending...' : 'Send POST'}
                </Button>
                {echo.data && <Button variant="outline" onClick={echo.reset}>Clear</Button>}
              </Stack>
            </div>
          </Card>

          {echo.error && <Alert variant="destructive">{echo.error.message}</Alert>}
          {echo.data && (
            <Card title="Echo Response">
              <pre className="response">{JSON.stringify(echo.data, null, 2)}</pre>
            </Card>
          )}
        </Stack>
      )
    }

    // ── Tab 4: Real-time (useEventStream) ──
    function StreamTab() {
      const [listening, setListening] = useState(false)
      const stream = useEventStream(listening ? 'tick' : null)

      return (
        <Stack gap="1.5rem">
          <Card title="Server-Sent Events" subtitle="useEventStream('tick') — real-time updates from _server.js">
            <Stack direction="row" gap="0.5rem" align="center">
              <Button onClick={() => setListening(!listening)} variant={listening ? 'destructive' : 'default'}>
                {listening ? 'Stop Listening' : 'Start Stream'}
              </Button>
              {stream.connected && <Badge variant="outline">Connected</Badge>}
              {stream.messages.length > 0 && (
                <Button size="sm" variant="outline" onClick={stream.clear}>Clear</Button>
              )}
            </Stack>
          </Card>

          {stream.messages.length > 0 && (
            <Card title={\`Events (\${stream.messages.length})\`}>
              <div className="event-log">
                {stream.messages.slice(-20).reverse().map((msg, i) => (
                  <div key={i} className="event-item">
                    <Stack direction="row" justify="space-between">
                      <span>#{msg.data.count}</span>
                      <span style={{ color: 'var(--color-muted-foreground)', fontSize: '0.75rem' }}>
                        {new Date(msg.data.ts).toLocaleTimeString()}
                      </span>
                    </Stack>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Stack>
      )
    }

    // ── Main App ──
    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '3rem' }}><Spinner size="lg" /></Stack>

      const tabs = [
        { id: 'backend', label: 'Backend API', icon: '🗄️' },
        { id: 'fetch', label: 'External Fetch', icon: '🌐' },
        { id: 'mutation', label: 'Mutations', icon: '📤' },
        { id: 'stream', label: 'Real-time', icon: '⚡' },
      ]

      const panels = {
        backend: <BackendTab />,
        fetch: <FetchTab />,
        mutation: <MutationTab />,
        stream: <StreamTab />,
      }

      return (
        <div>
          <Stack direction="row" align="center" gap="0.75rem" style={{ marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔌</span>
            <div>
              <h2 style={{ margin: 0 }}>API Explorer</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-muted-foreground)' }}>
                Data-fetching hooks demo: useApi, useFetch, useAsync, useEventStream
              </p>
            </div>
          </Stack>
          <Tabs tabs={tabs} defaultTab="backend">
            {(activeTab) => panels[activeTab]}
          </Tabs>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'component-showcase',
    name: 'Component Showcase',
    description: 'An interactive storybook that demos all 47 @kinbot/components with live examples. Browse by category: Layout, Forms, Data Display, Feedback, Navigation, Overlays, Charts, and Extra.',
    icon: '🧩',
    tags: ['components', 'storybook', 'demo', 'reference', 'ui'],
    suggestedSlug: 'component-showcase',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Component Showcase</title>
  <style>
    body { padding: 0; margin: 0; }
    .showcase { display: flex; min-height: 100vh; }
    .sidebar {
      width: 220px; min-width: 220px; padding: 1rem;
      border-right: 1px solid var(--color-border);
      background: var(--color-surface-secondary);
      overflow-y: auto; position: sticky; top: 0; height: 100vh;
    }
    .sidebar h2 { font-size: 1rem; margin: 0 0 1rem; color: var(--color-text-primary); }
    .sidebar-cat { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
      color: var(--color-text-tertiary); margin: 1rem 0 0.25rem; font-weight: 600; }
    .sidebar-item {
      padding: 0.35rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer;
      font-size: 0.8rem; color: var(--color-text-secondary); transition: all 0.15s;
    }
    .sidebar-item:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
    .sidebar-item.active { background: var(--color-primary); color: white; }
    .main { flex: 1; padding: 1.5rem; overflow-y: auto; }
    .section { margin-bottom: 2rem; }
    .section-title { font-size: 1.1rem; font-weight: 600; margin: 0 0 0.25rem; color: var(--color-text-primary); }
    .section-desc { font-size: 0.8rem; color: var(--color-text-tertiary); margin-bottom: 1rem; }
    .demo-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-start; margin-bottom: 1rem; }
    .demo-box {
      padding: 1rem; border-radius: var(--radius-md);
      border: 1px solid var(--color-border); background: var(--color-surface-primary);
    }
    .demo-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--color-text-tertiary); margin-bottom: 0.5rem; font-weight: 600; }
    @media (max-width: 640px) {
      .showcase { flex-direction: column; }
      .sidebar { width: 100%; min-width: 100%; height: auto; position: static;
        display: flex; flex-wrap: wrap; gap: 0.25rem; border-right: none;
        border-bottom: 1px solid var(--color-border); }
      .sidebar-cat { width: 100%; }
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useRef } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot } from '@kinbot/react'
    import {
      Stack, Divider, Card, Button, ButtonGroup, Input, Textarea, Select,
      Checkbox, Switch, Badge, Tag, Stat, Avatar, Tooltip, ProgressBar,
      Alert, Spinner, Skeleton, EmptyState, Tabs, Table, List, Pagination,
      Modal, Drawer, Grid, Breadcrumbs, Popover, Form, DataGrid, Accordion,
      DropdownMenu, Panel, RadioGroup, Slider, DatePicker,
      BarChart, LineChart, PieChart, SparkLine,
      Stepper, StepperContent,
      FileUpload, CodeBlock, Timeline, AvatarGroup, NumberInput,
      Combobox, TagInput
    } from '@kinbot/components'

    const CATEGORIES = [
      { id: 'layout', label: 'Layout', items: ['Stack','Divider','Card','Grid','Panel'] },
      { id: 'forms', label: 'Forms', items: ['Button','ButtonGroup','Input','Textarea','Select','Checkbox','Switch','RadioGroup','Slider','DatePicker','Combobox','TagInput','Form'] },
      { id: 'data', label: 'Data Display', items: ['Badge','Tag','Stat','Avatar','Tooltip','ProgressBar','Table','List','DataGrid','Accordion'] },
      { id: 'feedback', label: 'Feedback', items: ['Alert','Spinner','Skeleton','EmptyState'] },
      { id: 'nav', label: 'Navigation', items: ['Tabs','Breadcrumbs','Pagination','DropdownMenu','Stepper'] },
      { id: 'overlays', label: 'Overlays', items: ['Modal','Drawer','Popover'] },
      { id: 'charts', label: 'Charts', items: ['BarChart','LineChart','PieChart','SparkLine'] },
      { id: 'extra', label: 'Extra', items: ['FileUpload','CodeBlock','Timeline','AvatarGroup','NumberInput'] },
    ]

    // ─── Demo sections ───
    function LayoutDemo() {
      return <>
        <div className="demo-box">
          <div className="demo-label">Stack (horizontal)</div>
          <Stack direction="row" gap="0.5rem">
            <Badge>One</Badge><Badge variant="success">Two</Badge><Badge variant="warning">Three</Badge>
          </Stack>
        </div>
        <div className="demo-box">
          <div className="demo-label">Grid (3 columns)</div>
          <Grid columns={3} gap="0.5rem">
            <Card style={{padding:'0.75rem',textAlign:'center'}}>A</Card>
            <Card style={{padding:'0.75rem',textAlign:'center'}}>B</Card>
            <Card style={{padding:'0.75rem',textAlign:'center'}}>C</Card>
          </Grid>
        </div>
        <div className="demo-box">
          <div className="demo-label">Panel (collapsible)</div>
          <Panel title="Settings" icon="⚙️" collapsible>
            <div>Panel content goes here</div>
          </Panel>
        </div>
        <div className="demo-box" style={{maxWidth:'400px'}}>
          <div className="demo-label">Divider</div>
          <Stack gap="0.5rem"><span>Above</span><Divider /><span>Below</span></Stack>
        </div>
        <div className="demo-box">
          <div className="demo-label">Card</div>
          <Card hover style={{padding:'1rem',maxWidth:'240px'}}>Hoverable card with content</Card>
        </div>
      </>
    }

    function FormsDemo() {
      const [sw, setSw] = useState(true)
      const [sl, setSl] = useState(50)
      const [radio, setRadio] = useState('a')
      return <>
        <div className="demo-row">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="demo-row">
          <ButtonGroup><Button variant="outline">Left</Button><Button variant="outline">Center</Button><Button variant="outline">Right</Button></ButtonGroup>
        </div>
        <div className="demo-row" style={{maxWidth:'300px'}}>
          <Input label="Text input" placeholder="Type something..." />
          <Input label="With error" error="This field is required" />
        </div>
        <div className="demo-row" style={{maxWidth:'300px'}}>
          <Textarea label="Textarea" placeholder="Write more..." />
          <Select label="Select" options={[{value:'a',label:'Option A'},{value:'b',label:'Option B'},{value:'c',label:'Option C'}]} placeholder="Choose..." />
        </div>
        <div className="demo-row">
          <Checkbox label="Accept terms" />
          <Switch label="Dark mode" checked={sw} onChange={() => setSw(!sw)} />
        </div>
        <div className="demo-box" style={{maxWidth:'300px'}}>
          <RadioGroup name="demo" label="Choose one" value={radio} onChange={e => setRadio(e.target.value)}
            options={[{value:'a',label:'Alpha'},{value:'b',label:'Beta'},{value:'c',label:'Gamma'}]} />
        </div>
        <div className="demo-box" style={{maxWidth:'300px'}}>
          <Slider label="Volume" value={sl} onChange={e => setSl(Number(e.target.value))} min={0} max={100} />
        </div>
        <div className="demo-box" style={{maxWidth:'220px'}}>
          <DatePicker label="Pick a date" />
        </div>
        <div className="demo-box" style={{maxWidth:'350px'}}>
          <div className="demo-label">Combobox</div>
          <Combobox label="Country" placeholder="Select a country..." clearable
            options={[
              {value:'fr',label:'France',icon:'🇫🇷',description:'Western Europe'},
              {value:'us',label:'United States',icon:'🇺🇸',description:'North America'},
              {value:'jp',label:'Japan',icon:'🇯🇵',description:'East Asia'},
              {value:'br',label:'Brazil',icon:'🇧🇷',description:'South America'},
              {value:'de',label:'Germany',icon:'🇩🇪',description:'Western Europe'},
            ]}
            onChange={v => KinBot.toast('Selected: ' + v)} />
        </div>
        <div className="demo-box" style={{maxWidth:'350px'}}>
          <div className="demo-label">TagInput</div>
          <TagInput label="Skills" placeholder="Add a skill..."
            suggestions={['React','TypeScript','Python','Rust','Go','Tailwind','Docker','Kubernetes']}
            maxTags={6} value={['React','TypeScript']}
            onChange={tags => console.log('Tags:', tags)} />
        </div>
      </>
    }

    function DataDemo() {
      return <>
        <div className="demo-row">
          <Badge>Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
        <div className="demo-row">
          <Tag>React</Tag><Tag onRemove={() => {}}>Removable</Tag><Tag variant="success">New</Tag>
        </div>
        <div className="demo-row">
          <Stat value="1,234" label="Users" trend="+12%" trendUp />
          <Stat value="$48.2k" label="Revenue" trend="-3%" />
        </div>
        <div className="demo-row">
          <Avatar initials="NV" /><Avatar initials="EM" size={32} /><Avatar initials="CB" size={48} />
        </div>
        <div className="demo-row">
          <Tooltip text="I'm a tooltip!"><Button variant="outline" size="sm">Hover me</Button></Tooltip>
        </div>
        <div className="demo-box" style={{maxWidth:'300px'}}>
          <div className="demo-label">ProgressBar</div>
          <Stack gap="0.5rem">
            <ProgressBar value={75} showLabel />
            <ProgressBar value={30} color="var(--color-warning)" height={6} />
          </Stack>
        </div>
        <div className="demo-box">
          <div className="demo-label">Table</div>
          <Table columns={[{key:'name',label:'Name'},{key:'role',label:'Role'}]}
            data={[{name:'Alice',role:'Admin'},{name:'Bob',role:'Editor'},{name:'Claire',role:'Viewer'}]} />
        </div>
        <div className="demo-box">
          <div className="demo-label">List</div>
          <List items={[{id:'1',content:'First item'},{id:'2',content:'Second item'},{id:'3',content:'Third item'}]} />
        </div>
        <div className="demo-box">
          <div className="demo-label">Accordion</div>
          <Accordion items={[{title:'Section 1',content:'Content for section one'},{title:'Section 2',content:'Content for section two'}]} />
        </div>
      </>
    }

    function FeedbackDemo() {
      return <>
        <div className="demo-box"><Alert variant="info" title="Info">Informational message</Alert></div>
        <div className="demo-box"><Alert variant="success" title="Success">Operation completed</Alert></div>
        <div className="demo-box"><Alert variant="warning" title="Warning" dismissible>Be careful</Alert></div>
        <div className="demo-box"><Alert variant="danger" title="Error">Something went wrong</Alert></div>
        <div className="demo-row">
          <Spinner /><Spinner size={16} /><Spinner size={32} />
        </div>
        <div className="demo-box" style={{maxWidth:'300px'}}>
          <div className="demo-label">Skeleton</div>
          <Stack gap="0.5rem">
            <Skeleton width="60%" /><Skeleton /><Skeleton height="4rem" rounded />
          </Stack>
        </div>
        <div className="demo-box">
          <EmptyState icon="📭" title="No results" description="Try a different search query"
            action={<Button size="sm">Clear filters</Button>} />
        </div>
      </>
    }

    function NavDemo() {
      const [tab, setTab] = useState('one')
      const [page, setPage] = useState(3)
      return <>
        <div className="demo-box">
          <Tabs tabs={[{id:'one',label:'First'},{id:'two',label:'Second'},{id:'three',label:'Third'}]}
            active={tab} onChange={setTab} />
          <div style={{padding:'0.75rem',color:'var(--color-text-secondary)'}}>Active: {tab}</div>
        </div>
        <div className="demo-box">
          <Breadcrumbs items={[{label:'Home',href:'#'},{label:'Components',href:'#'},{label:'Nav'}]} />
        </div>
        <div className="demo-box">
          <Pagination page={page} totalPages={10} onChange={setPage} />
        </div>
        <div className="demo-box">
          <DropdownMenu trigger={<Button variant="outline" size="sm">Actions ▾</Button>}
            items={[{label:'Edit',icon:'✏️',onClick:()=>{}},{label:'Duplicate',icon:'📋',onClick:()=>{}},{type:'separator'},{label:'Delete',icon:'🗑️',variant:'danger',onClick:()=>{}}]} />
        </div>
        <div className="demo-box">
          <div className="demo-label">Stepper</div>
          <StepperDemo />
        </div>
      </>
    }

    function StepperDemo() {
      const [step, setStep] = useState(1)
      return <Stepper steps={[{label:'Account'},{label:'Profile'},{label:'Confirm'}]} activeStep={step} onStepClick={setStep} />
    }

    function OverlaysDemo() {
      const [modal, setModal] = useState(false)
      const [drawer, setDrawer] = useState(false)
      return <>
        <div className="demo-row">
          <Button onClick={() => setModal(true)}>Open Modal</Button>
          <Button variant="outline" onClick={() => setDrawer(true)}>Open Drawer</Button>
          <Popover trigger={<Button variant="secondary">Popover</Button>}
            content={<div style={{padding:'0.5rem'}}>Popover content here</div>} />
        </div>
        <Modal open={modal} onClose={() => setModal(false)} title="Example Modal">
          <div style={{padding:'1rem'}}>
            <p>This is a modal dialog with a title and close button.</p>
            <div style={{display:'flex',justifyContent:'flex-end',gap:'0.5rem',marginTop:'1rem'}}>
              <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
              <Button onClick={() => setModal(false)}>Confirm</Button>
            </div>
          </div>
        </Modal>
        <Drawer open={drawer} onClose={() => setDrawer(false)} title="Example Drawer">
          <div style={{padding:'1rem'}}>
            <p>Drawer slides in from the side. Great for detail panels.</p>
            <List items={[{id:'1',content:'Item A'},{id:'2',content:'Item B'},{id:'3',content:'Item C'}]} />
          </div>
        </Drawer>
      </>
    }

    function ChartsDemo() {
      const barData = [{label:'Mon',value:34},{label:'Tue',value:52},{label:'Wed',value:41},{label:'Thu',value:67},{label:'Fri',value:55}]
      const lineData = [{label:'Jan',value:120},{label:'Feb',value:180},{label:'Mar',value:150},{label:'Apr',value:220},{label:'May',value:190},{label:'Jun',value:280}]
      const pieData = [{label:'Desktop',value:55},{label:'Mobile',value:35},{label:'Tablet',value:10}]
      return <>
        <div className="demo-box">
          <div className="demo-label">BarChart</div>
          <BarChart data={barData} height={180} showValues showGrid animate />
        </div>
        <div className="demo-box">
          <div className="demo-label">LineChart</div>
          <LineChart data={lineData} height={180} showDots showArea curved animate />
        </div>
        <div className="demo-row">
          <div className="demo-box">
            <div className="demo-label">PieChart</div>
            <PieChart data={pieData} width={200} height={200} showLabels showLegend animate />
          </div>
          <div className="demo-box">
            <div className="demo-label">PieChart (donut)</div>
            <PieChart data={pieData} width={200} height={200} donut showLegend animate />
          </div>
        </div>
        <div className="demo-box" style={{maxWidth:'300px'}}>
          <div className="demo-label">SparkLine</div>
          <Stack direction="row" gap="1.5rem" align="center">
            <SparkLine data={[10,25,18,32,28,45,38]} width={120} height={32} showArea />
            <SparkLine data={[40,35,42,30,25,20,15]} width={120} height={32} color="var(--color-danger)" showArea />
          </Stack>
        </div>
      </>
    }

    function ExtraDemo() {
      const [num, setNum] = useState(5)
      return <>
        <div className="demo-box">
          <div className="demo-label">FileUpload</div>
          <FileUpload accept="image/*" multiple maxSize={5*1024*1024} maxFiles={3}
            onFiles={files => KinBot.toast('Received ' + files.length + ' file(s)')}
            onError={err => KinBot.toast(err, 'error')}
            label="Drop images here" hint="Max 5MB, up to 3 files" />
        </div>
        <div className="demo-box">
          <div className="demo-label">CodeBlock</div>
          <CodeBlock language="javascript" showLineNumbers code={\`function greet(name) {\\n  return \\\`Hello, \\\${name}!\\\`;\\n}\\n\\nconsole.log(greet('KinBot'));\`} />
        </div>
        <div className="demo-box">
          <div className="demo-label">Timeline</div>
          <Timeline items={[
            { title: 'App created', time: '10:00 AM', icon: '🚀', color: 'var(--color-success)' },
            { title: 'First update', description: 'Added new features', time: '11:30 AM', color: 'var(--color-primary)' },
            { title: 'Published', time: '2:00 PM', icon: '✅', color: 'var(--color-success)' },
          ]} />
        </div>
        <div className="demo-box">
          <div className="demo-label">AvatarGroup</div>
          <Stack direction="row" gap="1.5rem" align="center">
            <AvatarGroup avatars={[{name:'Alice'},{name:'Bob'},{name:'Claire'},{name:'Dan'},{name:'Eve'}]} max={3} size="md" />
            <AvatarGroup avatars={[{name:'NV'},{name:'EM'}]} size="lg" />
          </Stack>
        </div>
        <div className="demo-box" style={{maxWidth:'200px'}}>
          <div className="demo-label">NumberInput</div>
          <NumberInput label="Quantity" value={num} onChange={setNum} min={0} max={100} step={1} />
        </div>
      </>
    }

    const SECTIONS = {
      layout: { title: 'Layout', desc: 'Stack, Divider, Card, Grid, Panel', render: LayoutDemo },
      forms: { title: 'Forms', desc: 'Buttons, inputs, selects, toggles, sliders, date pickers, combobox, tag input', render: FormsDemo },
      data: { title: 'Data Display', desc: 'Badges, tags, stats, avatars, tables, lists, accordions', render: DataDemo },
      feedback: { title: 'Feedback', desc: 'Alerts, spinners, skeletons, empty states', render: FeedbackDemo },
      nav: { title: 'Navigation', desc: 'Tabs, breadcrumbs, pagination, dropdown menus, stepper', render: NavDemo },
      overlays: { title: 'Overlays', desc: 'Modal, Drawer, Popover', render: OverlaysDemo },
      charts: { title: 'Charts', desc: 'Bar, Line, Pie, SparkLine', render: ChartsDemo },
      extra: { title: 'Extra', desc: 'FileUpload, CodeBlock, Timeline, AvatarGroup, NumberInput', render: ExtraDemo },
    }

    function App() {
      const { theme } = useKinBot()
      const [active, setActive] = useState('layout')
      const section = SECTIONS[active]

      return (
        <div className="showcase">
          <nav className="sidebar">
            <h2>🧩 Components</h2>
            {CATEGORIES.map(cat => (
              <div key={cat.id}>
                <div className="sidebar-cat">{cat.label}</div>
                {cat.items.map(item => {
                  const catId = cat.id
                  return <div key={item} className={'sidebar-item' + (active === catId ? ' active' : '')}
                    onClick={() => setActive(catId)}>{item}</div>
                })}
              </div>
            ))}
          </nav>
          <main className="main">
            <div className="section">
              <h1 className="section-title">{section.title}</h1>
              <div className="section-desc">{section.desc}</div>
              <section.render />
            </div>
          </main>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'data-browser',
    name: 'Data Browser',
    description: 'Demonstrates both pagination patterns: traditional page-based navigation (usePagination) and infinite scroll (useInfiniteScroll). Includes a backend that generates 200 mock records with filtering and sorting.',
    icon: '📋',
    tags: ['pagination', 'data', 'table', 'infinite-scroll', 'hooks', 'usePagination', 'useInfiniteScroll', 'backend'],
    suggestedSlug: 'data-browser',
    files: {
      'app.json': REACT_APP_JSON,
      '_server.js': `// Backend: paginated data with filtering and sorting
const CATEGORIES = ['Engineering', 'Design', 'Marketing', 'Sales', 'Support']
const STATUSES = ['active', 'inactive', 'pending']
const FIRST = ['Alice', 'Bob', 'Claire', 'David', 'Emma', 'Fabien', 'Grace', 'Hugo', 'Iris', 'Jules', 'Kate', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul', 'Quinn', 'Rose', 'Sam', 'Tina']
const LAST = ['Martin', 'Chen', 'Dubois', 'Kim', 'Wilson', 'Roux', 'Lee', 'Bernard', 'Moreau', 'Singh']

// Generate 200 stable mock records
const ALL_RECORDS = Array.from({ length: 200 }, (_, i) => ({
  id: i + 1,
  name: FIRST[i % FIRST.length] + ' ' + LAST[i % LAST.length],
  email: (FIRST[i % FIRST.length] + '.' + LAST[i % LAST.length] + '@example.com').toLowerCase(),
  department: CATEGORIES[i % CATEGORIES.length],
  status: STATUSES[i % STATUSES.length],
  score: 40 + ((i * 7 + 13) % 61),
  joined: new Date(2023, i % 12, (i % 28) + 1).toISOString().slice(0, 10),
}))

function filterRecords(records, query, department, status) {
  return records.filter(r => {
    if (query && !r.name.toLowerCase().includes(query.toLowerCase()) && !r.email.toLowerCase().includes(query.toLowerCase())) return false
    if (department && r.department !== department) return false
    if (status && r.status !== status) return false
    return true
  })
}

function sortRecords(records, sortBy, sortDir) {
  if (!sortBy) return records
  return [...records].sort((a, b) => {
    const va = a[sortBy], vb = b[sortBy]
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb))
    return sortDir === 'desc' ? -cmp : cmp
  })
}

export default {
  'GET /records': async (req) => {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '20')
    const query = url.searchParams.get('q') || ''
    const department = url.searchParams.get('department') || ''
    const status = url.searchParams.get('status') || ''
    const sortBy = url.searchParams.get('sort') || ''
    const sortDir = url.searchParams.get('dir') || 'asc'

    let filtered = filterRecords(ALL_RECORDS, query, department, status)
    filtered = sortRecords(filtered, sortBy, sortDir)
    const total = filtered.length
    const items = filtered.slice((page - 1) * limit, page * limit)

    return Response.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) })
  },

  'GET /departments': async () => {
    return Response.json({ departments: CATEGORIES })
  },
}`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Data Browser</title>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import React, { useState, useCallback } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useApi, usePagination, useInfiniteScroll, useTheme } from '@kinbot/react'
    import { Card, Stack, Tabs, Badge, Input, Select, Button, ButtonGroup, Table, Spinner, EmptyState, Stat, Divider, Pagination, Tag, Alert } from '@kinbot/components'

    // ─── Filters (shared between both views) ────────────────────────────────
    function Filters({ query, setQuery, department, setDepartment, status, setStatus, departments }) {
      return React.createElement(Stack, { direction: 'row', gap: '0.5rem', align: 'end', wrap: true },
        React.createElement(Input, {
          label: 'Search',
          placeholder: 'Name or email...',
          value: query,
          onChange: e => setQuery(e.target.value),
          style: { minWidth: '200px', flex: 1 },
        }),
        React.createElement(Select, {
          label: 'Department',
          value: department,
          onChange: e => setDepartment(e.target.value),
          options: [{ value: '', label: 'All' }, ...departments.map(d => ({ value: d, label: d }))],
        }),
        React.createElement(Select, {
          label: 'Status',
          value: status,
          onChange: e => setStatus(e.target.value),
          options: [
            { value: '', label: 'All' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'pending', label: 'Pending' },
          ],
        }),
      )
    }

    // ─── Status badge helper ─────────────────────────────────────────────────
    function statusVariant(s) {
      return s === 'active' ? 'success' : s === 'pending' ? 'warning' : 'default'
    }

    // ─── Columns definition ──────────────────────────────────────────────────
    const COLUMNS = [
      { key: 'id', label: '#', width: '50px' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'department', label: 'Dept' },
      { key: 'status', label: 'Status', render: (v) => React.createElement(Badge, { variant: statusVariant(v) }, v) },
      { key: 'score', label: 'Score', render: (v) => React.createElement('span', { style: { fontWeight: 600, color: v >= 80 ? 'var(--color-success)' : v >= 60 ? 'var(--color-warning)' : 'var(--color-error)' } }, v) },
      { key: 'joined', label: 'Joined' },
    ]

    // ─── Tab 1: Table with usePagination ─────────────────────────────────────
    function PaginatedView({ query, department, status }) {
      const qp = new URLSearchParams()
      if (query) qp.set('q', query)
      if (department) qp.set('department', department)
      if (status) qp.set('status', status)
      const qs = qp.toString()
      const path = '/records' + (qs ? '?' + qs : '')

      const { items, loading, error, page, totalPages, setPage, refetch } = usePagination(path, {
        pageSize: 15,
        getItems: res => res.items,
        getTotal: res => res.total,
      })

      if (error) return React.createElement(Alert, { variant: 'error', title: 'Error' }, error)
      if (loading && items.length === 0) return React.createElement(Stack, { align: 'center', style: { padding: '3rem' } }, React.createElement(Spinner, { size: 32 }))
      if (!loading && items.length === 0) return React.createElement(EmptyState, { icon: '🔍', title: 'No results', description: 'Try adjusting your filters' })

      return React.createElement(Stack, { gap: '1rem' },
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement(Table, { columns: COLUMNS, data: items }),
        ),
        React.createElement(Stack, { direction: 'row', align: 'center', justify: 'space-between' },
          React.createElement('span', { style: { fontSize: '0.85rem', color: 'var(--color-text-secondary)' } },
            'Page ' + page + ' of ' + (totalPages || '?')
          ),
          React.createElement(Pagination, { page, totalPages: totalPages || 1, onChange: setPage }),
        ),
      )
    }

    // ─── Tab 2: Cards with useInfiniteScroll ─────────────────────────────────
    function InfiniteView({ query, department, status }) {
      const qp = new URLSearchParams()
      if (query) qp.set('q', query)
      if (department) qp.set('department', department)
      if (status) qp.set('status', status)
      const qs = qp.toString()
      const path = '/records' + (qs ? '?' + qs : '')

      const { items, loading, loadingMore, error, hasMore, loadMore, reset, sentinelRef } = useInfiniteScroll(path, {
        pageSize: 20,
        getItems: res => res.items,
        getHasMore: (res, extracted) => res.page < res.totalPages,
        autoLoad: true,
        threshold: 300,
      })

      if (error) return React.createElement(Alert, { variant: 'error', title: 'Error' }, error)
      if (loading && items.length === 0) return React.createElement(Stack, { align: 'center', style: { padding: '3rem' } }, React.createElement(Spinner, { size: 32 }))
      if (!loading && items.length === 0) return React.createElement(EmptyState, { icon: '🔍', title: 'No results', description: 'Try adjusting your filters' })

      return React.createElement(Stack, { gap: '0.75rem' },
        React.createElement('div', { style: { fontSize: '0.85rem', color: 'var(--color-text-secondary)' } },
          items.length + ' records loaded' + (hasMore ? ' (scroll for more)' : ' (all loaded)')
        ),
        React.createElement('div', {
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' },
        },
          ...items.map(r => React.createElement(Card, { key: r.id, hover: true },
            React.createElement(Card.Header, null,
              React.createElement(Card.Title, { as: 'h4' }, r.name),
              React.createElement(Card.Description, null, r.email),
            ),
            React.createElement(Card.Content, null,
              React.createElement(Stack, { direction: 'row', gap: '0.5rem', wrap: true },
                React.createElement(Tag, null, r.department),
                React.createElement(Badge, { variant: statusVariant(r.status) }, r.status),
                React.createElement(Badge, { variant: 'outline' }, 'Score: ' + r.score),
              ),
            ),
            React.createElement(Card.Footer, null,
              React.createElement('span', { style: { fontSize: '0.8rem', color: 'var(--color-text-tertiary)' } }, 'Joined ' + r.joined),
            ),
          )),
        ),
        React.createElement('div', { ref: sentinelRef, style: { padding: '1rem', textAlign: 'center' } },
          loadingMore ? React.createElement(Spinner, { size: 20 }) : null,
          !hasMore && items.length > 0 ? React.createElement('span', { style: { fontSize: '0.85rem', color: 'var(--color-text-tertiary)' } }, 'All records loaded') : null,
        ),
      )
    }

    // ─── App ─────────────────────────────────────────────────────────────────
    function App() {
      const [tab, setTab] = useState('table')
      const [query, setQuery] = useState('')
      const [department, setDepartment] = useState('')
      const [status, setStatus] = useState('')
      const { data: deptData } = useApi('/departments')
      const departments = deptData?.departments || []

      const tabs = [
        { id: 'table', label: 'Table View', icon: '📊' },
        { id: 'cards', label: 'Card View', icon: '🃏' },
      ]

      return React.createElement(Stack, { gap: '1rem', style: { padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' } },
        React.createElement(Stack, { direction: 'row', align: 'center', justify: 'space-between', wrap: true },
          React.createElement('h2', { style: { margin: 0 } }, '📋 Data Browser'),
          React.createElement(Stack, { direction: 'row', gap: '0.5rem' },
            React.createElement(Stat, { value: '200', label: 'Total Records' }),
          ),
        ),
        React.createElement(Alert, { variant: 'info' },
          tab === 'table'
            ? 'Table view uses usePagination: items are replaced on each page change. Navigate with the pagination controls below.'
            : 'Card view uses useInfiniteScroll: new items append as you scroll down. Try scrolling to the bottom!',
        ),
        React.createElement(Filters, { query, setQuery, department, setDepartment, status, setStatus, departments }),
        React.createElement(Divider, null),
        React.createElement(Tabs, { tabs, active: tab, onChange: setTab }),
        tab === 'table'
          ? React.createElement(PaginatedView, { query, department, status })
          : React.createElement(InfiniteView, { query, department, status }),
      )
    }

    createRoot(document.getElementById('root')).render(React.createElement(App))
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'responsive',
    name: 'Responsive Layout',
    description: 'A responsive profile/portfolio page demonstrating mobile-first design with responsive CSS utilities (sm:/md:/lg: prefixes), useBreakpoint() hook, Grid, Card, Tabs, and adaptive layouts.',
    icon: '📱',
    tags: ['responsive', 'layout', 'mobile', 'breakpoints', 'grid', 'portfolio'],
    suggestedSlug: 'responsive-demo',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Responsive Layout</title>
  <style>
    body { padding: 1rem; }
    .hero { text-align: center; padding: 2rem 1rem; }
    .hero-avatar { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 1rem; background: var(--color-primary); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white; }
    .breakpoint-pill { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: var(--color-primary); color: white; }
    @media (min-width: 768px) { .hero { text-align: left; display: flex; align-items: center; gap: 1.5rem; } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useBreakpoint } from '@kinbot/react'
    import {
      Card, Stat, Badge, Tabs, Spinner, Stack, Grid, ProgressBar,
      List, Tag, Alert, Divider, SparkLine
    } from '@kinbot/components'

    const skills = [
      { name: 'React', level: 92 },
      { name: 'TypeScript', level: 88 },
      { name: 'Node.js', level: 85 },
      { name: 'Python', level: 72 },
      { name: 'CSS/Design', level: 80 },
      { name: 'DevOps', level: 65 },
    ]

    const projects = [
      { name: 'E-Commerce Platform', desc: 'Full-stack shop with payments', tags: ['React', 'Node.js'], progress: 95 },
      { name: 'Analytics Dashboard', desc: 'Real-time metrics visualization', tags: ['TypeScript', 'D3'], progress: 78 },
      { name: 'Mobile App', desc: 'Cross-platform fitness tracker', tags: ['React Native'], progress: 45 },
      { name: 'API Gateway', desc: 'Microservices orchestration', tags: ['Go', 'Docker'], progress: 60 },
      { name: 'Design System', desc: 'Component library & docs', tags: ['CSS', 'Storybook'], progress: 88 },
      { name: 'ML Pipeline', desc: 'Data processing & inference', tags: ['Python', 'PyTorch'], progress: 32 },
    ]

    const activity = [12, 18, 8, 24, 15, 22, 30, 28, 19, 35, 42, 38]

    function App() {
      const { ready } = useKinBot()
      const bp = useBreakpoint()
      const [tab, setTab] = useState('skills')

      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>

      return (
        <div>
          {/* Breakpoint indicator */}
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <span className="breakpoint-pill">
              {bp.toUpperCase()} {bp === 'xs' ? '< 640px' : bp === 'sm' ? '\\u2265 640px' : bp === 'md' ? '\\u2265 768px' : bp === 'lg' ? '\\u2265 1024px' : '\\u2265 1280px'}
            </span>
          </div>

          {/* Hero — centers on mobile, side-by-side on md+ */}
          <div className="hero">
            <div className="hero-avatar">JD</div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Jane Developer</h2>
              <p style={{ color: 'var(--color-muted-foreground)', margin: '0.25rem 0' }}>Full-Stack Engineer</p>
              <Stack direction="row" gap="0.5rem" style={{ justifyContent: bp === 'xs' || bp === 'sm' ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
                <Badge variant="primary">Open to work</Badge>
                <Badge variant="outline">Remote</Badge>
                <Badge variant="outline">5+ years</Badge>
              </Stack>
            </div>
          </div>

          <Divider style={{ margin: '1rem 0' }} />

          {/* Stats grid — 2 cols on mobile, 4 on md+ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" style={{ marginBottom: '1.5rem' }}>
            {[
              { label: 'Projects', value: '24', trend: '\\u2191 3', trendUp: true },
              { label: 'Commits', value: '1.2k', trend: '\\u2191 89', trendUp: true },
              { label: 'Stars', value: '847', trend: '\\u2191 12%', trendUp: true },
              { label: 'Followers', value: '312', trend: '\\u2191 8', trendUp: true },
            ].map((s, i) => (
              <Card key={i} hover className={"animate-fade-in-up delay-" + (i + 1)}>
                <Card.Content><Stat value={s.value} label={s.label} trend={s.trend} trendUp={s.trendUp} /></Card.Content>
              </Card>
            ))}
          </div>

          {/* Activity sparkline */}
          <Card style={{ marginBottom: '1.5rem' }} className="animate-fade-in">
            <Card.Header>
              <Card.Title>Activity (12 months)</Card.Title>
            </Card.Header>
            <Card.Content>
              <SparkLine data={activity} height={40} color="var(--color-primary)" showArea />
            </Card.Content>
          </Card>

          {/* Tabbed content */}
          <Tabs
            tabs={[
              { id: 'skills', label: bp === 'xs' ? 'Skills' : '\\ud83d\\udcaa Skills' },
              { id: 'projects', label: bp === 'xs' ? 'Projects' : '\\ud83d\\udcc1 Projects' },
            ]}
            active={tab}
            onChange={setTab}
            style={{ marginBottom: '1rem' }}
          />

          {tab === 'skills' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-fade-in">
              {skills.map((s) => (
                <Card key={s.name}>
                  <Card.Content>
                    <Stack direction="row" align="center" justify="space-between" style={{ marginBottom: '0.5rem' }}>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <Badge variant={s.level >= 85 ? 'success' : s.level >= 70 ? 'warning' : 'outline'}>{s.level}%</Badge>
                    </Stack>
                    <ProgressBar value={s.level} height={6} />
                  </Card.Content>
                </Card>
              ))}
            </div>
          )}

          {tab === 'projects' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in">
              {projects.map((p) => (
                <Card key={p.name} hover>
                  <Card.Header>
                    <Card.Title>{p.name}</Card.Title>
                    <Card.Description>{p.desc}</Card.Description>
                  </Card.Header>
                  <Card.Content>
                    <ProgressBar value={p.progress} height={6} showLabel style={{ marginBottom: '0.75rem' }} />
                    <Stack direction="row" gap="0.5rem" style={{ flexWrap: 'wrap' }}>
                      {p.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                    </Stack>
                  </Card.Content>
                </Card>
              ))}
            </div>
          )}

          <Alert variant="info" style={{ marginTop: '1.5rem' }}>
            Resize the panel to see responsive breakpoints in action. The layout adapts using CSS utility classes like <code>grid-cols-1 sm:grid-cols-2 lg:grid-cols-3</code> and the <code>useBreakpoint()</code> hook.
          </Alert>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'multi-page',
    name: 'Multi-Page App',
    description: 'A multi-page mini-app demonstrating hash-based routing with useHashRouter, Route, and Link from @kinbot/react. Includes a nav bar, home, about, and settings pages.',
    icon: '🗺️',
    tags: ['routing', 'multi-page', 'navigation', 'spa'],
    suggestedSlug: 'multi-page-app',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Multi-Page App</title>
  <style>
    body { margin: 0; padding: 0; }
    .app-nav {
      display: flex; gap: 0.25rem; padding: 0.75rem 1rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-secondary);
    }
    .app-nav a {
      padding: 0.4rem 0.75rem; border-radius: var(--radius-sm);
      font-size: 0.85rem; color: var(--color-text-secondary);
      text-decoration: none; transition: all 0.15s;
    }
    .app-nav a:hover { background: var(--color-surface-hover); color: var(--color-text-primary); }
    .app-nav a.link-active { background: var(--color-primary); color: white; }
    .page { padding: 1.5rem; max-width: 600px; }
    .page h1 { margin: 0 0 0.5rem; font-size: 1.3rem; color: var(--color-text-primary); }
    .page p { color: var(--color-text-secondary); line-height: 1.6; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useHashRouter, Route, Link } from '@kinbot/react'
    import { Card, Stack, Switch, Select, Button, Alert } from '@kinbot/components'

    function HomePage() {
      return <div className="page">
        <h1>🏠 Home</h1>
        <p>Welcome to this multi-page mini-app! Use the navigation above to browse pages.</p>
        <Card style={{ padding: '1rem', marginTop: '1rem' }} hover>
          <Stack gap="0.5rem">
            <strong>How it works</strong>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>
              This app uses <code>useHashRouter</code> from <code>@kinbot/react</code> for
              client-side routing. No page reloads needed. Try the browser back/forward buttons too!
            </p>
          </Stack>
        </Card>
      </div>
    }

    function AboutPage() {
      return <div className="page">
        <h1>ℹ️ About</h1>
        <p>This template demonstrates hash-based routing in a KinBot mini-app.</p>
        <Alert variant="info" title="Routing primitives" style={{ marginTop: '1rem' }}>
          <code>useHashRouter()</code> returns path, params, navigate, and back.
          <code>Route</code> and <code>Link</code> handle rendering and navigation.
        </Alert>
      </div>
    }

    function SettingsPage() {
      const [dark, setDark] = useState(false)
      return <div className="page">
        <h1>⚙️ Settings</h1>
        <Card style={{ padding: '1rem' }}>
          <Stack gap="1rem">
            <Switch label="Dark mode (demo toggle)" checked={dark} onChange={() => setDark(!dark)} />
            <Select label="Language" options={[
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'de', label: 'Deutsch' },
            ]} placeholder="Choose..." />
            <Button onClick={() => KinBot.toast('Settings saved!')}>Save</Button>
          </Stack>
        </Card>
      </div>
    }

    function NotFound({ path }) {
      return <div className="page">
        <h1>404</h1>
        <p>Page <code>{path}</code> not found.</p>
        <Button variant="outline" onClick={() => location.hash = '#/'}>Go home</Button>
      </div>
    }

    function App() {
      const { path } = useHashRouter('/')

      return <>
        <nav className="app-nav">
          <Link to="/" active={path === '/'}>Home</Link>
          <Link to="/about" active={path === '/about'}>About</Link>
          <Link to="/settings" active={path === '/settings'}>Settings</Link>
        </nav>
        <Route path="/" current={path}><HomePage /></Route>
        <Route path="/about" current={path}><AboutPage /></Route>
        <Route path="/settings" current={path}><SettingsPage /></Route>
        <Route fallback current={path}><NotFound path={path} /></Route>
      </>
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'contact-manager',
    name: 'Contact Manager',
    description: 'A CRUD contact manager demonstrating Combobox, TagInput, Form, DataGrid, Modal, and backend persistence. Showcases advanced form components with search, filtering, and inline editing.',
    icon: '👥',
    tags: ['form', 'crud', 'combobox', 'taginput', 'datagrid', 'modal', 'backend', 'components'],
    suggestedSlug: 'contacts',
    files: {
      'app.json': REACT_APP_JSON,
      '_server.js': `// Backend: in-memory contact store with CRUD
const contacts = [
  { id: 1, name: 'Alice Martin', email: 'alice@example.com', company: 'Acme Corp', role: 'Engineering', tags: ['vip', 'partner'], createdAt: '2026-01-15T10:00:00Z' },
  { id: 2, name: 'Bob Chen', email: 'bob@example.com', company: 'StartupXYZ', role: 'Design', tags: ['lead'], createdAt: '2026-02-01T14:30:00Z' },
  { id: 3, name: 'Claire Dubois', email: 'claire@example.com', company: 'Acme Corp', role: 'Marketing', tags: ['vip'], createdAt: '2026-02-10T09:15:00Z' },
]
let nextId = 4

export default {
  async fetch(req) {
    const url = new URL(req.url)

    if (req.method === 'GET' && url.pathname === '/contacts') {
      const q = (url.searchParams.get('q') || '').toLowerCase()
      const role = url.searchParams.get('role') || ''
      let results = [...contacts]
      if (q) results = results.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q))
      if (role) results = results.filter(c => c.role === role)
      return Response.json({ items: results.sort((a, b) => b.id - a.id), total: results.length })
    }

    if (req.method === 'POST' && url.pathname === '/contacts') {
      const body = await req.json()
      const errors = {}
      if (!body.name?.trim()) errors.name = 'Name is required'
      if (!body.email?.trim()) errors.email = 'Email is required'
      else if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(body.email)) errors.email = 'Invalid email'
      else if (contacts.some(c => c.email === body.email && c.id !== body.id)) errors.email = 'Email already exists'
      if (!body.role) errors.role = 'Role is required'
      if (Object.keys(errors).length > 0) return Response.json({ ok: false, errors }, { status: 422 })

      if (body.id) {
        const idx = contacts.findIndex(c => c.id === body.id)
        if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 })
        contacts[idx] = { ...contacts[idx], ...body }
        return Response.json({ ok: true, contact: contacts[idx] })
      }
      const contact = { id: nextId++, ...body, tags: body.tags || [], createdAt: new Date().toISOString() }
      contacts.push(contact)
      return Response.json({ ok: true, contact })
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/contacts/')) {
      const id = parseInt(url.pathname.split('/')[2])
      const idx = contacts.findIndex(c => c.id === id)
      if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 })
      contacts.splice(idx, 1)
      return Response.json({ ok: true })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Manager</title>
  <style>
    body { padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .toolbar { display: flex; gap: 0.75rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 1rem; }
    .toolbar > * { flex: 1; min-width: 150px; }
    .toolbar .btn-add { flex: 0 0 auto; min-width: auto; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    @media (max-width: 480px) { .form-row { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useCallback } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useForm, useApi, toast } from '@kinbot/react'
    import {
      Card, Stack, Button, Input, Combobox, TagInput, DataGrid, Modal,
      Badge, Stat, Divider, Spinner, EmptyState, Alert
    } from '@kinbot/components'

    const ROLES = [
      { value: 'Engineering', label: 'Engineering', icon: '⚙️' },
      { value: 'Design', label: 'Design', icon: '🎨' },
      { value: 'Marketing', label: 'Marketing', icon: '📢' },
      { value: 'Sales', label: 'Sales', icon: '💼' },
      { value: 'Support', label: 'Support', icon: '🎧' },
      { value: 'Management', label: 'Management', icon: '👔' },
    ]
    const TAG_SUGGESTIONS = ['vip', 'partner', 'lead', 'prospect', 'churned', 'internal', 'vendor']

    function ContactForm({ initial, onSave, onCancel }) {
      const { values, errors, setValue, setErrors, handleSubmit, submitting } = useForm({
        initialValues: initial || { name: '', email: '', company: '', role: '', tags: [] },
      })
      const [serverErrors, setServerErrors] = useState({})

      const save = useCallback(async (vals) => {
        setServerErrors({})
        const res = await KinBot.api('/contacts', { method: 'POST', body: JSON.stringify(vals), headers: { 'Content-Type': 'application/json' } })
        const data = await res.json()
        if (!data.ok) { setServerErrors(data.errors || {}); throw new Error('Validation failed') }
        toast.success(initial?.id ? 'Contact updated' : 'Contact created')
        onSave()
      }, [initial, onSave])

      const allErrors = { ...errors }
      Object.entries(serverErrors).forEach(([k, v]) => { if (!allErrors[k]) allErrors[k] = v })

      return (
        <Stack gap="1rem">
          <div className="form-row">
            <Input label="Name" value={values.name} onChange={e => setValue('name', e.target.value)} error={allErrors.name} required />
            <Input label="Email" type="email" value={values.email} onChange={e => setValue('email', e.target.value)} error={allErrors.email} required />
          </div>
          <div className="form-row">
            <Input label="Company" value={values.company} onChange={e => setValue('company', e.target.value)} />
            <Combobox label="Role" options={ROLES} value={values.role} onChange={v => setValue('role', v)} placeholder="Select role..." error={allErrors.role} clearable />
          </div>
          <TagInput label="Tags" value={values.tags || []} onChange={v => setValue('tags', v)} suggestions={TAG_SUGGESTIONS} placeholder="Add tags..." variant="primary" />
          <Stack direction="row" gap="0.75rem" justify="flex-end">
            {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
            <Button onClick={() => handleSubmit(save)} disabled={submitting}>
              {submitting ? <Spinner size={16} /> : (initial?.id ? 'Update' : 'Create')}
            </Button>
          </Stack>
        </Stack>
      )
    }

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      return <ContactApp />
    }

    function ContactApp() {
      const [search, setSearch] = useState('')
      const [roleFilter, setRoleFilter] = useState('')
      const [modalOpen, setModalOpen] = useState(false)
      const [editing, setEditing] = useState(null)
      const { data, loading, refetch } = useApi('/contacts?q=' + encodeURIComponent(search) + (roleFilter ? '&role=' + roleFilter : ''))

      const columns = [
        { key: 'name', header: 'Name', sortable: true },
        { key: 'email', header: 'Email', sortable: true },
        { key: 'company', header: 'Company', sortable: true },
        { key: 'role', header: 'Role', render: (v) => <Badge variant="secondary">{v}</Badge> },
        { key: 'tags', header: 'Tags', render: (v) => (
          <Stack direction="row" gap="0.25rem" wrap>{(v || []).map(t => <Badge key={t} variant="outline">{t}</Badge>)}</Stack>
        )},
        { key: 'id', header: '', render: (_, row) => (
          <Stack direction="row" gap="0.5rem">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditing(row); setModalOpen(true) }}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={async (e) => {
              e.stopPropagation()
              if (await KinBot.confirm('Delete ' + row.name + '?')) {
                await KinBot.api('/contacts/' + row.id, { method: 'DELETE' })
                toast.success('Deleted')
                refetch()
              }
            }}>🗑️</Button>
          </Stack>
        )},
      ]

      return (
        <div className="animate-fade-in-up">
          <Stack direction="row" align="center" justify="space-between" style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>👥 Contacts</h2>
            <Stat value={data?.total ?? '—'} label="total" />
          </Stack>

          <div className="toolbar">
            <Input placeholder="Search name, email, company..." value={search} onChange={e => setSearch(e.target.value)} />
            <Combobox options={[{ value: '', label: 'All roles' }, ...ROLES]} value={roleFilter} onChange={v => setRoleFilter(v || '')} placeholder="Filter role..." clearable />
            <Button className="btn-add" onClick={() => { setEditing(null); setModalOpen(true) }}>+ New</Button>
          </div>

          {loading ? <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack> :
           !data?.items?.length ? <EmptyState icon="👥" title="No contacts" description={search || roleFilter ? 'Try different filters' : 'Add your first contact'} action={!search && !roleFilter ? { label: 'Add Contact', onClick: () => { setEditing(null); setModalOpen(true) } } : undefined} /> :
           <Card><DataGrid columns={columns} data={data.items} pageSize={10} /></Card>}

          <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing?.id ? 'Edit Contact' : 'New Contact'}>
            <ContactForm initial={editing} onSave={() => { setModalOpen(false); refetch() }} onCancel={() => setModalOpen(false)} />
          </Modal>
        </div>
      )
    }

    createRoot(document.getElementById('root')).render(<App />)
  </script>
</body>
</html>`,
    },
  },
]

export function getTemplateById(id: string): MiniAppTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

// ─── get_mini_app_templates tool ────────────────────────────────────────────

export const getMiniAppTemplatesTool: ToolRegistration = {
  availability: ['main'],
  create: (_ctx) =>
    tool({
      description:
        'Get a list of starter templates for mini apps. Returns template metadata (name, description, icon, tags) ' +
        'and optionally the full file contents for a specific template. ' +
        'Use this to quickly scaffold a new mini app instead of writing everything from scratch. ' +
        'After getting the template files, use create_mini_app with the HTML content and write_mini_app_file for additional files.',
      inputSchema: z.object({
        template_id: z.string().optional().describe(
          'If provided, returns the full file contents for this template. ' +
          'If omitted, returns a summary list of all available templates.'
        ),
      }),
      execute: async ({ template_id }) => {
        if (template_id) {
          const tmpl = TEMPLATES.find((t) => t.id === template_id)
          if (!tmpl) {
            return { error: `Template "${template_id}" not found. Use get_mini_app_templates without template_id to see available templates.` }
          }
          return {
            template: {
              id: tmpl.id,
              name: tmpl.name,
              description: tmpl.description,
              icon: tmpl.icon,
              tags: tmpl.tags,
              suggestedSlug: tmpl.suggestedSlug,
              files: tmpl.files,
            },
          }
        }

        return {
          templates: TEMPLATES.map((t) => ({
            id: t.id,
            name: t.name,
            description: t.description,
            icon: t.icon,
            tags: t.tags,
            suggestedSlug: t.suggestedSlug,
          })),
        }
      },
    }),
}
