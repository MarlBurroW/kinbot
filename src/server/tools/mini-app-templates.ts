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
    description: 'A responsive dashboard with stat cards, a chart area, and a recent activity list. Great starting point for data visualization apps.',
    icon: '📊',
    tags: ['data', 'charts', 'statistics'],
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
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card { padding: 1.25rem; border-radius: var(--radius-lg); }
    .stat-value { font-size: 1.75rem; font-weight: 700; margin: 0.25rem 0; }
    .stat-label { font-size: 0.8rem; color: var(--color-muted-foreground); }
    .stat-change { font-size: 0.75rem; margin-top: 0.25rem; }
    .stat-change.positive { color: var(--color-success); }
    .stat-change.negative { color: var(--color-destructive); }
    .main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; }
    @media (max-width: 640px) { .main-grid { grid-template-columns: 1fr; } }
    .section { padding: 1.25rem; border-radius: var(--radius-lg); }
    .section-title { font-size: 0.875rem; font-weight: 600; margin-bottom: 1rem; }
    .chart-placeholder {
      height: 200px; border-radius: var(--radius-md); background: var(--color-muted);
      display: flex; align-items: center; justify-content: center;
      color: var(--color-muted-foreground); font-size: 0.875rem;
    }
    .activity-list { list-style: none; }
    .activity-item {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.625rem 0; border-bottom: 1px solid var(--color-border); font-size: 0.85rem;
    }
    .activity-item:last-child { border-bottom: none; }
    .activity-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-primary); flex-shrink: 0; }
    .activity-time { margin-left: auto; color: var(--color-muted-foreground); font-size: 0.75rem; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { createRoot } from 'react-dom/client'
    import { useKinBot } from '@kinbot/react'

    const stats = [
      { label: 'Total Users', value: '2,847', change: '+12.5%', positive: true },
      { label: 'Revenue', value: '$48.2k', change: '+8.1%', positive: true },
      { label: 'Active Now', value: '142', change: '-3.2%', positive: false },
    ]

    const activities = [
      { text: 'New user signed up', time: '2m ago' },
      { text: 'Order #1234 completed', time: '15m ago' },
      { text: 'Report generated', time: '1h ago' },
      { text: 'Settings updated', time: '3h ago' },
    ]

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>

      return (
        <div>
          <h2 className="gradient-primary-text" style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.25rem' }}>Dashboard</h2>
          <div className="stats-grid">
            {stats.map((s, i) => (
              <div key={i} className={"stat-card surface-card card-hover animate-fade-in-up delay-" + i}>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
                <div className={"stat-change " + (s.positive ? 'positive' : 'negative')}>
                  {s.positive ? '\\u2191' : '\\u2193'} {s.change}
                </div>
              </div>
            ))}
          </div>
          <div className="main-grid">
            <div className="section surface-card animate-fade-in-up delay-3">
              <div className="section-title">Overview</div>
              <div className="chart-placeholder">Replace with your chart library</div>
            </div>
            <div className="section surface-card animate-fade-in-up delay-4">
              <div className="section-title">Recent Activity</div>
              <ul className="activity-list">
                {activities.map((a, i) => (
                  <li key={i} className="activity-item">
                    <span className="activity-dot" />
                    {a.text}
                    <span className="activity-time">{a.time}</span>
                  </li>
                ))}
              </ul>
            </div>
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
    description: 'A clean form with validation, multiple input types, and submission handling. Useful as a starting point for data entry apps.',
    icon: '📝',
    tags: ['form', 'input', 'data-entry'],
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
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    .subtitle { font-size: 0.85rem; color: var(--color-muted-foreground); margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1.25rem; }
    .form-group label { display: block; margin-bottom: 0.375rem; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    select {
      display: block; width: 100%; border-radius: var(--radius-md);
      border: 1px solid var(--color-input); background: transparent;
      padding: 0.5rem 0.75rem; font-size: 0.875rem; font-family: var(--font-sans); color: var(--color-foreground);
    }
    select:focus { outline: none; border-color: var(--color-ring); box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-ring) 25%, transparent); }
    .checkbox-group { display: flex; align-items: center; gap: 0.5rem; }
    .checkbox-group input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--color-primary); }
    .form-actions {
      display: flex; gap: 0.75rem; justify-content: flex-end;
      margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--color-border);
    }
    .error-text { color: var(--color-destructive); font-size: 0.75rem; margin-top: 0.25rem; display: none; }
    .form-group.has-error .error-text { display: block; }
    .form-group.has-error .input,
    .form-group.has-error .textarea,
    .form-group.has-error select { border-color: var(--color-destructive); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useRef } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, toast } from '@kinbot/react'

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>
      return <ContactForm />
    }

    function ContactForm() {
      const [errors, setErrors] = useState({})
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
      }

      const Field = ({ name, label, required, error, children }) => (
        <div className={"form-group" + (error ? " has-error" : "")}>
          <label className="label">{label}{required && ' *'}</label>
          {children}
          {error && <div className="error-text" style={{ display: 'block' }}>{error}</div>}
        </div>
      )

      return (
        <div className="animate-fade-in-up">
          <h2 className="gradient-primary-text">Contact Form</h2>
          <p className="subtitle">Fill in the details below and submit.</p>
          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="form-row">
              <Field name="firstName" label="First Name" required error={errors.firstName}>
                <input className="input" name="firstName" placeholder="John" />
              </Field>
              <Field name="lastName" label="Last Name" required error={errors.lastName}>
                <input className="input" name="lastName" placeholder="Doe" />
              </Field>
            </div>
            <Field name="email" label="Email" required error={errors.email}>
              <input className="input" name="email" type="email" placeholder="john@example.com" />
            </Field>
            <Field name="category" label="Category">
              <select name="category">
                <option value="">Select a category...</option>
                <option value="general">General Inquiry</option>
                <option value="support">Support</option>
                <option value="feedback">Feedback</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field name="message" label="Message">
              <textarea className="textarea" name="message" placeholder="Write your message here..." />
            </Field>
            <div className="form-group">
              <div className="checkbox-group">
                <input type="checkbox" id="agree" name="agree" />
                <label className="label" htmlFor="agree" style={{ marginBottom: 0 }}>I agree to the terms</label>
              </div>
            </div>
            <div className="form-actions">
              <button type="reset" className="btn btn-ghost" onClick={() => setErrors({})}>Reset</button>
              <button type="submit" className="btn btn-primary btn-shine">Submit</button>
            </div>
          </form>
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
    description: 'A searchable, sortable data table with pagination. Ideal for displaying collections, logs, or records.',
    icon: '🗂️',
    tags: ['table', 'data', 'search'],
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
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .toolbar { display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center; }
    .toolbar input { flex: 1; }
    .table-wrapper { border-radius: var(--radius-lg); overflow: hidden; }
    .pagination {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 1rem; font-size: 0.8rem; color: var(--color-muted-foreground);
    }
    .pagination-btns { display: flex; gap: 0.375rem; }
    .status-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 0.375rem; }
    .status-dot.active { background: var(--color-success); }
    .status-dot.inactive { background: var(--color-muted-foreground); }
    .status-dot.pending { background: var(--color-warning); }
    th[data-sortable] { cursor: pointer; user-select: none; }
    th[data-sortable]:hover { background: var(--color-muted); }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/jsx">
    import { useState, useMemo } from 'react'
    import { createRoot } from 'react-dom/client'
    import { useKinBot, toast, prompt } from '@kinbot/react'

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

    function App() {
      const { ready } = useKinBot()
      if (!ready) return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Loading...</div>
      return <DataViewer />
    }

    function DataViewer() {
      const [data, setData] = useState(INITIAL_DATA)
      const [search, setSearch] = useState('')
      const [page, setPage] = useState(0)
      const [sortKey, setSortKey] = useState('name')
      const [sortDir, setSortDir] = useState(1)

      const filtered = useMemo(() => {
        let result = data
        if (search) {
          const q = search.toLowerCase()
          result = data.filter(r => r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.status.includes(q))
        }
        return [...result].sort((a, b) => {
          const va = a[sortKey] || '', vb = b[sortKey] || ''
          return va < vb ? -sortDir : va > vb ? sortDir : 0
        })
      }, [data, search, sortKey, sortDir])

      const maxPage = Math.max(0, Math.ceil(filtered.length / PER_PAGE) - 1)
      const currentPage = Math.min(page, maxPage)
      const slice = filtered.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE)

      const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d * -1)
        else { setSortKey(key); setSortDir(1) }
      }

      const addEntry = async () => {
        const name = await prompt('Enter name:', { title: 'Add Entry' })
        if (!name) return
        const email = await prompt('Enter email:', { title: 'Add Entry' })
        if (!email) return
        setData(prev => [...prev, { id: Date.now(), name, email, status: 'active' }])
        toast('Entry added', 'success')
      }

      const sortIndicator = (key) => sortKey === key ? (sortDir === 1 ? ' \\u2191' : ' \\u2193') : ' \\u2195'

      return (
        <div className="animate-fade-in-up">
          <h2 className="gradient-primary-text">Data Viewer</h2>
          <div className="toolbar">
            <input className="input" type="text" placeholder="Search..."
              value={search} onInput={e => { setSearch(e.target.value); setPage(0) }} />
            <button className="btn btn-primary btn-sm btn-shine" onClick={addEntry}>+ Add</button>
          </div>
          <div className="table-wrapper surface-card">
            <table className="table">
              <thead>
                <tr>
                  <th data-sortable onClick={() => toggleSort('name')}>Name{sortIndicator('name')}</th>
                  <th data-sortable onClick={() => toggleSort('email')}>Email{sortIndicator('email')}</th>
                  <th data-sortable onClick={() => toggleSort('status')}>Status{sortIndicator('status')}</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-muted-foreground)', padding: '2rem' }}>No results found</td></tr>
                ) : slice.map(r => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.email}</td>
                    <td><span className={"status-dot " + r.status} />{r.status}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={() => toast('Edit entry #' + r.id, 'info')}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pagination">
            <span>{filtered.length === 0 ? 'No entries' : (currentPage * PER_PAGE + 1) + '-' + Math.min((currentPage + 1) * PER_PAGE, filtered.length) + ' of ' + filtered.length}</span>
            <div className="pagination-btns">
              <button className="btn btn-ghost btn-sm" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>\\u2190 Prev</button>
              <button className="btn btn-ghost btn-sm" disabled={currentPage >= maxPage} onClick={() => setPage(p => p + 1)}>Next \\u2192</button>
            </div>
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
