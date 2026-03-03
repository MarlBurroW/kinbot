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
    description: 'A clean form with validation using @kinbot/components (Card, Input, Select, Textarea, Checkbox, Button, Alert, Divider, Stack).',
    icon: '📝',
    tags: ['form', 'input', 'data-entry', 'components'],
    suggestedSlug: 'form',
    files: {
      'app.json': REACT_APP_JSON,
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form</title>
  <style>
    body { padding: 1.5rem; max-width: 520px; margin: 0 auto; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useRef } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, toast } from '@kinbot/react'
    import { Card, Input, Select, Textarea, Checkbox, Button, ButtonGroup, Alert, Divider, Stack, Spinner } from '@kinbot/components'

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <Stack align="center" style={{ padding: '2rem' }}><Spinner /></Stack>
      return <ContactForm />
    }

    function ContactForm() {
      const [errors, setErrors] = useState({})
      const [submitted, setSubmitted] = useState(false)
      const formRef = useRef(null)

      const handleSubmit = (e) => {
        e.preventDefault()
        const data = Object.fromEntries(new FormData(formRef.current))

        const newErrors = {}
        if (!data.firstName?.trim()) newErrors.firstName = 'Required'
        if (!data.lastName?.trim()) newErrors.lastName = 'Required'
        if (!data.email?.trim()) newErrors.email = 'Enter a valid email'

        setErrors(newErrors)
        if (Object.keys(newErrors).length > 0) return

        toast('Form submitted successfully!', 'success')
        console.log('Form data:', data)
        formRef.current.reset()
        setErrors({})
        setSubmitted(true)
      }

      return (
        <div className="animate-fade-in-up">
          <Card>
            <Card.Header>
              <Card.Title className="gradient-primary-text">Contact Form</Card.Title>
              <Card.Description>Fill in the details below and submit.</Card.Description>
            </Card.Header>
            <Card.Content>
              {submitted && (
                <Alert variant="success" title="Success!" dismissible onDismiss={() => setSubmitted(false)} style={{ marginBottom: '1rem' }}>
                  Your form was submitted successfully.
                </Alert>
              )}
              <form ref={formRef} onSubmit={handleSubmit}>
                <Stack gap="1rem">
                  <div className="form-row">
                    <Input name="firstName" label="First Name *" placeholder="John" error={errors.firstName} />
                    <Input name="lastName" label="Last Name *" placeholder="Doe" error={errors.lastName} />
                  </div>
                  <Input name="email" label="Email *" type="email" placeholder="john@example.com" error={errors.email} />
                  <Select
                    name="category"
                    label="Category"
                    placeholder="Select a category..."
                    options={[
                      { value: 'general', label: 'General Inquiry' },
                      { value: 'support', label: 'Support' },
                      { value: 'feedback', label: 'Feedback' },
                      { value: 'other', label: 'Other' },
                    ]}
                  />
                  <Textarea name="message" label="Message" placeholder="Write your message here..." />
                  <Checkbox name="agree" label="I agree to the terms" />
                  <Divider />
                  <Stack direction="row" justify="flex-end" gap="0.75rem">
                    <Button type="reset" variant="ghost" onClick={() => { setErrors({}); setSubmitted(false) }}>Reset</Button>
                    <Button type="submit" variant="shine">Submit</Button>
                  </Stack>
                </Stack>
              </form>
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
    description: 'A settings/preferences panel using Form, Switch, Select, and Input components with storage persistence. Great for configuration UIs.',
    icon: '⚙️',
    tags: ['settings', 'form', 'preferences', 'config', 'storage'],
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
    .section { margin-bottom: 1.5rem; }
    .section-title { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-muted-foreground); margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--color-border); }
    .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0; }
    .setting-label { font-size: 0.875rem; font-weight: 500; }
    .setting-desc { font-size: 0.75rem; color: var(--color-muted-foreground); margin-top: 0.125rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useEffect } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, useStorage, toast } from '@kinbot/react'
    import { Card, Switch, Select, Input, Button, Divider, Badge, Alert } from '@kinbot/components'

    const DEFAULTS = {
      notifications: true,
      darkMode: 'auto',
      language: 'en',
      fontSize: '14',
      autoSave: true,
      compactMode: false,
      soundEffects: true,
      displayName: '',
    }

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>
      return <SettingsPanel />
    }

    function SettingsPanel() {
      const [settings, setSettings, loading] = useStorage('app-settings', DEFAULTS)
      const [dirty, setDirty] = useState(false)

      if (loading) return null

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
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <h2 className="gradient-primary-text">Settings</h2>
            {dirty && <Badge variant="warning">Unsaved</Badge>}
          </div>
          <div className="subtitle">Configure your app preferences</div>

          <Card className="section">
            <div className="section-title">Appearance</div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Theme</div>
                <div className="setting-desc">Choose your preferred color scheme</div>
              </div>
              <Select value={settings.darkMode} onChange={e => update('darkMode', e.target.value)} style={{ width: 130 }}>
                <option value="auto">Auto</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Font Size</div>
                <div className="setting-desc">Base text size in pixels</div>
              </div>
              <Select value={settings.fontSize} onChange={e => update('fontSize', e.target.value)} style={{ width: 130 }}>
                <option value="12">Small (12px)</option>
                <option value="14">Default (14px)</option>
                <option value="16">Large (16px)</option>
                <option value="18">Extra Large (18px)</option>
              </Select>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Compact Mode</div>
                <div className="setting-desc">Reduce spacing for denser layouts</div>
              </div>
              <Switch checked={settings.compactMode} onChange={e => update('compactMode', e.target.checked)} />
            </div>
          </Card>

          <Card className="section">
            <div className="section-title">Notifications</div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Push Notifications</div>
                <div className="setting-desc">Receive alerts for important updates</div>
              </div>
              <Switch checked={settings.notifications} onChange={e => update('notifications', e.target.checked)} />
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Sound Effects</div>
                <div className="setting-desc">Play sounds for interactions</div>
              </div>
              <Switch checked={settings.soundEffects} onChange={e => update('soundEffects', e.target.checked)} />
            </div>
          </Card>

          <Card className="section">
            <div className="section-title">Profile</div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Display Name</div>
                <div className="setting-desc">How others see you</div>
              </div>
              <Input value={settings.displayName} onChange={e => update('displayName', e.target.value)} placeholder="Enter name" style={{ width: 180 }} />
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Language</div>
                <div className="setting-desc">Interface language</div>
              </div>
              <Select value={settings.language} onChange={e => update('language', e.target.value)} style={{ width: 130 }}>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="es">Español</option>
                <option value="ja">日本語</option>
              </Select>
            </div>

            <div className="setting-row">
              <div>
                <div className="setting-label">Auto-Save</div>
                <div className="setting-desc">Automatically save changes</div>
              </div>
              <Switch checked={settings.autoSave} onChange={e => update('autoSave', e.target.checked)} />
            </div>
          </Card>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={reset}>Reset to Defaults</Button>
            <Button onClick={save} disabled={!dirty}>Save Changes</Button>
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
