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

const TEMPLATES: MiniAppTemplate[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'A responsive dashboard with stat cards, a chart area, and a recent activity list. Great starting point for data visualization apps.',
    icon: '📊',
    tags: ['data', 'charts', 'statistics'],
    suggestedSlug: 'dashboard',
    files: {
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
    .stat-card {
      padding: 1.25rem;
      border-radius: var(--radius-lg);
    }
    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0.25rem 0;
    }
    .stat-label {
      font-size: 0.8rem;
      color: var(--color-muted-foreground);
    }
    .stat-change {
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }
    .stat-change.positive { color: var(--color-success); }
    .stat-change.negative { color: var(--color-destructive); }
    .main-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1rem;
    }
    @media (max-width: 640px) {
      .main-grid { grid-template-columns: 1fr; }
    }
    .section { padding: 1.25rem; border-radius: var(--radius-lg); }
    .section-title {
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .chart-placeholder {
      height: 200px;
      border-radius: var(--radius-md);
      background: var(--color-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-muted-foreground);
      font-size: 0.875rem;
    }
    .activity-list { list-style: none; }
    .activity-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0;
      border-bottom: 1px solid var(--color-border);
      font-size: 0.85rem;
    }
    .activity-item:last-child { border-bottom: none; }
    .activity-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--color-primary);
      flex-shrink: 0;
    }
    .activity-time {
      margin-left: auto;
      color: var(--color-muted-foreground);
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <h2 class="gradient-primary-text" style="font-size: 1.25rem; font-weight: 700; margin-bottom: 1.25rem;">Dashboard</h2>

  <div class="stats-grid">
    <div class="stat-card surface-card card-hover animate-fade-in-up">
      <div class="stat-label">Total Users</div>
      <div class="stat-value">2,847</div>
      <div class="stat-change positive">↑ 12.5%</div>
    </div>
    <div class="stat-card surface-card card-hover animate-fade-in-up delay-1">
      <div class="stat-label">Revenue</div>
      <div class="stat-value">$48.2k</div>
      <div class="stat-change positive">↑ 8.1%</div>
    </div>
    <div class="stat-card surface-card card-hover animate-fade-in-up delay-2">
      <div class="stat-label">Active Now</div>
      <div class="stat-value">142</div>
      <div class="stat-change negative">↓ 3.2%</div>
    </div>
  </div>

  <div class="main-grid">
    <div class="section surface-card animate-fade-in-up delay-3">
      <div class="section-title">Overview</div>
      <div class="chart-placeholder">📈 Replace with your chart library</div>
    </div>
    <div class="section surface-card animate-fade-in-up delay-4">
      <div class="section-title">Recent Activity</div>
      <ul class="activity-list">
        <li class="activity-item"><span class="activity-dot"></span> New user signed up <span class="activity-time">2m ago</span></li>
        <li class="activity-item"><span class="activity-dot"></span> Order #1234 completed <span class="activity-time">15m ago</span></li>
        <li class="activity-item"><span class="activity-dot"></span> Report generated <span class="activity-time">1h ago</span></li>
        <li class="activity-item"><span class="activity-dot"></span> Settings updated <span class="activity-time">3h ago</span></li>
      </ul>
    </div>
  </div>

  <script>
    KinBot.ready();
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'todo-list',
    name: 'Todo List',
    description: 'A fully functional todo list with persistence via KinBot.storage. Supports adding, completing, and deleting tasks.',
    icon: '✅',
    tags: ['productivity', 'storage', 'interactive'],
    suggestedSlug: 'todo-list',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Todo List</title>
  <style>
    body { padding: 1.5rem; max-width: 480px; margin: 0 auto; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .add-form {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .add-form input { flex: 1; }
    .todo-list { list-style: none; }
    .todo-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: var(--radius-md);
      margin-bottom: 0.5rem;
      transition: opacity 0.2s;
    }
    .todo-item.done { opacity: 0.5; }
    .todo-item.done .todo-text { text-decoration: line-through; }
    .todo-text { flex: 1; font-size: 0.9rem; }
    .todo-check {
      width: 20px; height: 20px;
      border-radius: var(--radius-sm);
      border: 2px solid var(--color-border);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      color: var(--color-primary-foreground);
      transition: all 0.15s;
    }
    .todo-check.checked {
      background: var(--color-primary);
      border-color: var(--color-primary);
    }
    .todo-delete {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--color-muted-foreground);
      font-size: 1.1rem;
      padding: 0 0.25rem;
      opacity: 0;
      transition: opacity 0.15s, color 0.15s;
    }
    .todo-item:hover .todo-delete { opacity: 1; }
    .todo-delete:hover { color: var(--color-destructive); }
    .empty-state {
      text-align: center;
      padding: 2rem;
      color: var(--color-muted-foreground);
      font-size: 0.9rem;
    }
    .counter {
      font-size: 0.75rem;
      color: var(--color-muted-foreground);
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <h2 class="gradient-primary-text">Todo List</h2>

  <div class="add-form">
    <input class="input" id="newTodo" type="text" placeholder="What needs to be done?" />
    <button class="btn btn-primary btn-shine" id="addBtn">Add</button>
  </div>

  <ul class="todo-list" id="todoList"></ul>
  <div class="counter" id="counter"></div>

  <script>
    let todos = [];

    const listEl = document.getElementById('todoList');
    const inputEl = document.getElementById('newTodo');
    const addBtn = document.getElementById('addBtn');
    const counterEl = document.getElementById('counter');

    function render() {
      if (todos.length === 0) {
        listEl.innerHTML = '<li class="empty-state animate-fade-in">No tasks yet. Add one above!</li>';
        counterEl.textContent = '';
        return;
      }
      const remaining = todos.filter(t => !t.done).length;
      counterEl.textContent = remaining + ' of ' + todos.length + ' remaining';
      listEl.innerHTML = todos.map((t, i) =>
        '<li class="todo-item surface-card ' + (t.done ? 'done' : '') + ' animate-fade-in-up">' +
          '<button class="todo-check ' + (t.done ? 'checked' : '') + '" data-i="' + i + '">' +
            (t.done ? '✓' : '') +
          '</button>' +
          '<span class="todo-text">' + escapeHtml(t.text) + '</span>' +
          '<button class="todo-delete" data-del="' + i + '">×</button>' +
        '</li>'
      ).join('');
    }

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    async function save() {
      await KinBot.storage.set('todos', todos);
    }

    async function addTodo() {
      const text = inputEl.value.trim();
      if (!text) return;
      todos.unshift({ text, done: false, id: Date.now() });
      inputEl.value = '';
      render();
      await save();
    }

    listEl.addEventListener('click', async (e) => {
      const checkBtn = e.target.closest('[data-i]');
      const delBtn = e.target.closest('[data-del]');
      if (checkBtn) {
        const i = parseInt(checkBtn.dataset.i);
        todos[i].done = !todos[i].done;
        render();
        await save();
      } else if (delBtn) {
        const i = parseInt(delBtn.dataset.del);
        todos.splice(i, 1);
        render();
        await save();
      }
    });

    addBtn.addEventListener('click', addTodo);
    inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTodo(); });

    // Load on ready
    KinBot.on('app-meta', async () => {
      const stored = await KinBot.storage.get('todos');
      if (Array.isArray(stored)) todos = stored;
      render();
    });
    KinBot.ready();
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
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Form</title>
  <style>
    body { padding: 1.5rem; max-width: 520px; margin: 0 auto; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
    .subtitle {
      font-size: 0.85rem;
      color: var(--color-muted-foreground);
      margin-bottom: 1.5rem;
    }
    .form-group {
      margin-bottom: 1.25rem;
    }
    .form-group label {
      display: block;
      margin-bottom: 0.375rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }
    select {
      display: block;
      width: 100%;
      border-radius: var(--radius-md);
      border: 1px solid var(--color-input);
      background: transparent;
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      font-family: var(--font-sans);
      color: var(--color-foreground);
    }
    select:focus {
      outline: none;
      border-color: var(--color-ring);
      box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-ring) 25%, transparent);
    }
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .checkbox-group input[type="checkbox"] {
      width: 16px; height: 16px;
      accent-color: var(--color-primary);
    }
    .form-actions {
      display: flex;
      gap: 0.75rem;
      justify-content: flex-end;
      margin-top: 1.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid var(--color-border);
    }
    .error-text {
      color: var(--color-destructive);
      font-size: 0.75rem;
      margin-top: 0.25rem;
      display: none;
    }
    .form-group.has-error .error-text { display: block; }
    .form-group.has-error .input,
    .form-group.has-error .textarea,
    .form-group.has-error select {
      border-color: var(--color-destructive);
    }
  </style>
</head>
<body>
  <div class="animate-fade-in-up">
    <h2 class="gradient-primary-text">Contact Form</h2>
    <p class="subtitle">Fill in the details below and submit.</p>

    <form id="form">
      <div class="form-row">
        <div class="form-group">
          <label class="label">First Name *</label>
          <input class="input" name="firstName" required placeholder="John" />
          <div class="error-text">Required</div>
        </div>
        <div class="form-group">
          <label class="label">Last Name *</label>
          <input class="input" name="lastName" required placeholder="Doe" />
          <div class="error-text">Required</div>
        </div>
      </div>

      <div class="form-group">
        <label class="label">Email *</label>
        <input class="input" name="email" type="email" required placeholder="john@example.com" />
        <div class="error-text">Enter a valid email</div>
      </div>

      <div class="form-group">
        <label class="label">Category</label>
        <select name="category">
          <option value="">Select a category...</option>
          <option value="general">General Inquiry</option>
          <option value="support">Support</option>
          <option value="feedback">Feedback</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div class="form-group">
        <label class="label">Message</label>
        <textarea class="textarea" name="message" placeholder="Write your message here..."></textarea>
      </div>

      <div class="form-group">
        <div class="checkbox-group">
          <input type="checkbox" id="agree" name="agree" />
          <label class="label" for="agree" style="margin-bottom: 0;">I agree to the terms</label>
        </div>
      </div>

      <div class="form-actions">
        <button type="reset" class="btn btn-ghost">Reset</button>
        <button type="submit" class="btn btn-primary btn-shine">Submit</button>
      </div>
    </form>
  </div>

  <script>
    const form = document.getElementById('form');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));

      // Basic validation
      let valid = true;
      form.querySelectorAll('[required]').forEach(input => {
        const group = input.closest('.form-group');
        if (!input.value.trim()) {
          group.classList.add('has-error');
          valid = false;
        } else {
          group.classList.remove('has-error');
        }
      });

      if (!valid) return;

      KinBot.toast('Form submitted successfully!', 'success');
      console.log('Form data:', data);
      form.reset();
    });

    KinBot.ready();
  </script>
</body>
</html>`,
    },
  },
  {
    id: 'data-viewer',
    name: 'Data Viewer',
    description: 'A searchable, sortable data table with pagination. Ideal for displaying collections, logs, or records. Includes a backend API template.',
    icon: '🗂️',
    tags: ['table', 'data', 'search', 'backend'],
    suggestedSlug: 'data-viewer',
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Viewer</title>
  <style>
    body { padding: 1.5rem; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .toolbar {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 1rem;
      align-items: center;
    }
    .toolbar input { flex: 1; }
    .table-wrapper {
      border-radius: var(--radius-lg);
      overflow: hidden;
    }
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      font-size: 0.8rem;
      color: var(--color-muted-foreground);
    }
    .pagination-btns {
      display: flex;
      gap: 0.375rem;
    }
    .status-dot {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      margin-right: 0.375rem;
    }
    .status-dot.active { background: var(--color-success); }
    .status-dot.inactive { background: var(--color-muted-foreground); }
    .status-dot.pending { background: var(--color-warning); }
  </style>
</head>
<body>
  <div class="animate-fade-in-up">
    <h2 class="gradient-primary-text">Data Viewer</h2>

    <div class="toolbar">
      <input class="input" id="search" type="text" placeholder="Search..." />
      <button class="btn btn-primary btn-sm btn-shine" id="addBtn">+ Add</button>
    </div>

    <div class="table-wrapper surface-card">
      <table class="table" id="dataTable">
        <thead>
          <tr>
            <th style="cursor:pointer" data-sort="name">Name ↕</th>
            <th style="cursor:pointer" data-sort="email">Email ↕</th>
            <th style="cursor:pointer" data-sort="status">Status ↕</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="tableBody"></tbody>
      </table>
    </div>

    <div class="pagination">
      <span id="pageInfo"></span>
      <div class="pagination-btns">
        <button class="btn btn-ghost btn-sm" id="prevBtn">← Prev</button>
        <button class="btn btn-ghost btn-sm" id="nextBtn">Next →</button>
      </div>
    </div>
  </div>

  <script>
    // Sample data - replace with KinBot.api calls for real data
    let data = [
      { id: 1, name: 'Alice Martin', email: 'alice@example.com', status: 'active' },
      { id: 2, name: 'Bob Chen', email: 'bob@example.com', status: 'inactive' },
      { id: 3, name: 'Claire Dubois', email: 'claire@example.com', status: 'active' },
      { id: 4, name: 'David Kim', email: 'david@example.com', status: 'pending' },
      { id: 5, name: 'Emma Wilson', email: 'emma@example.com', status: 'active' },
      { id: 6, name: 'Fabien Roux', email: 'fabien@example.com', status: 'active' },
      { id: 7, name: 'Grace Lee', email: 'grace@example.com', status: 'inactive' },
      { id: 8, name: 'Hugo Bernard', email: 'hugo@example.com', status: 'pending' },
    ];

    let page = 0;
    const perPage = 5;
    let sortKey = 'name';
    let sortDir = 1;
    let searchQuery = '';

    function getFiltered() {
      let filtered = data;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = data.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.status.includes(q)
        );
      }
      filtered.sort((a, b) => {
        const va = a[sortKey] || '', vb = b[sortKey] || '';
        return va < vb ? -sortDir : va > vb ? sortDir : 0;
      });
      return filtered;
    }

    function render() {
      const filtered = getFiltered();
      const total = filtered.length;
      const maxPage = Math.max(0, Math.ceil(total / perPage) - 1);
      if (page > maxPage) page = maxPage;
      const slice = filtered.slice(page * perPage, (page + 1) * perPage);

      document.getElementById('tableBody').innerHTML = slice.length === 0
        ? '<tr><td colspan="4" style="text-align:center;color:var(--color-muted-foreground);padding:2rem">No results found</td></tr>'
        : slice.map(r =>
          '<tr>' +
            '<td>' + r.name + '</td>' +
            '<td>' + r.email + '</td>' +
            '<td><span class="status-dot ' + r.status + '"></span>' + r.status + '</td>' +
            '<td><button class="btn btn-ghost btn-sm" data-edit="' + r.id + '">Edit</button></td>' +
          '</tr>'
        ).join('');

      document.getElementById('pageInfo').textContent =
        total === 0 ? 'No entries' : (page * perPage + 1) + '-' + Math.min((page + 1) * perPage, total) + ' of ' + total;
      document.getElementById('prevBtn').disabled = page === 0;
      document.getElementById('nextBtn').disabled = page >= maxPage;
    }

    document.getElementById('search').addEventListener('input', (e) => {
      searchQuery = e.target.value;
      page = 0;
      render();
    });

    document.getElementById('prevBtn').addEventListener('click', () => { page--; render(); });
    document.getElementById('nextBtn').addEventListener('click', () => { page++; render(); });

    document.querySelector('thead').addEventListener('click', (e) => {
      const th = e.target.closest('[data-sort]');
      if (!th) return;
      const key = th.dataset.sort;
      if (sortKey === key) sortDir *= -1;
      else { sortKey = key; sortDir = 1; }
      render();
    });

    document.getElementById('addBtn').addEventListener('click', async () => {
      const name = await KinBot.prompt('Enter name:', { title: 'Add Entry' });
      if (!name) return;
      const email = await KinBot.prompt('Enter email:', { title: 'Add Entry' });
      if (!email) return;
      data.push({ id: Date.now(), name, email, status: 'active' });
      render();
      KinBot.toast('Entry added', 'success');
    });

    document.getElementById('tableBody').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-edit]');
      if (btn) KinBot.toast('Edit entry #' + btn.dataset.edit, 'info');
    });

    KinBot.ready();
    render();
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
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban Board</title>
  <style>
    body { padding: 1rem; overflow-x: auto; }
    h2 { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; }
    .board {
      display: flex;
      gap: 1rem;
      min-height: 400px;
      align-items: flex-start;
    }
    .column {
      min-width: 220px;
      max-width: 280px;
      flex: 1;
      border-radius: var(--radius-lg);
      padding: 0.75rem;
    }
    .column-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
      padding: 0 0.25rem;
    }
    .column-title {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-muted-foreground);
    }
    .column-count {
      font-size: 0.7rem;
      padding: 0.125rem 0.5rem;
      border-radius: var(--radius-full);
      background: var(--color-muted);
      color: var(--color-muted-foreground);
    }
    .card-list {
      min-height: 60px;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .card-list.drag-over {
      outline: 2px dashed var(--color-primary);
      outline-offset: -2px;
      border-radius: var(--radius-md);
    }
    .kanban-card {
      padding: 0.75rem;
      border-radius: var(--radius-md);
      cursor: grab;
      font-size: 0.85rem;
      transition: box-shadow 0.15s, transform 0.15s;
    }
    .kanban-card:active { cursor: grabbing; }
    .kanban-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
    .kanban-card.dragging { opacity: 0.4; }
    .card-title { font-weight: 500; margin-bottom: 0.25rem; }
    .card-tags { display: flex; gap: 0.25rem; margin-top: 0.375rem; }
    .card-tag {
      font-size: 0.65rem;
      padding: 0.1rem 0.4rem;
      border-radius: var(--radius-full);
      background: var(--color-secondary);
      color: var(--color-secondary-foreground);
    }
    .add-card-btn {
      width: 100%;
      margin-top: 0.25rem;
      border-style: dashed;
      color: var(--color-muted-foreground);
    }
  </style>
</head>
<body>
  <h2 class="gradient-primary-text">Kanban Board</h2>
  <div class="board" id="board"></div>

  <script>
    let board = {
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
    };

    let dragData = null;

    function render() {
      const boardEl = document.getElementById('board');
      boardEl.innerHTML = board.columns.map(col =>
        '<div class="column glass-strong animate-fade-in-up">' +
          '<div class="column-header">' +
            '<span class="column-title">' + col.title + '</span>' +
            '<span class="column-count">' + col.cards.length + '</span>' +
          '</div>' +
          '<div class="card-list" data-col="' + col.id + '">' +
            col.cards.map(card =>
              '<div class="kanban-card surface-card" draggable="true" data-card="' + card.id + '" data-col="' + col.id + '">' +
                '<div class="card-title">' + card.title + '</div>' +
                (card.tags.length ? '<div class="card-tags">' + card.tags.map(t => '<span class="card-tag">' + t + '</span>').join('') + '</div>' : '') +
              '</div>'
            ).join('') +
          '</div>' +
          '<button class="btn btn-ghost btn-sm add-card-btn" data-add="' + col.id + '">+ Add card</button>' +
        '</div>'
      ).join('');

      // Drag events
      boardEl.querySelectorAll('[draggable]').forEach(card => {
        card.addEventListener('dragstart', (e) => {
          dragData = { cardId: card.dataset.card, fromCol: card.dataset.col };
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          boardEl.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        });
      });

      boardEl.querySelectorAll('.card-list').forEach(list => {
        list.addEventListener('dragover', (e) => { e.preventDefault(); list.classList.add('drag-over'); });
        list.addEventListener('dragleave', () => list.classList.remove('drag-over'));
        list.addEventListener('drop', (e) => {
          e.preventDefault();
          list.classList.remove('drag-over');
          if (!dragData) return;
          const toCol = list.dataset.col;
          moveCard(dragData.cardId, dragData.fromCol, toCol);
          dragData = null;
        });
      });

      // Add card buttons
      boardEl.querySelectorAll('[data-add]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const title = await KinBot.prompt('Card title:', { title: 'New Card' });
          if (!title) return;
          const col = board.columns.find(c => c.id === btn.dataset.add);
          if (col) {
            col.cards.push({ id: String(Date.now()), title, tags: [] });
            render();
            save();
          }
        });
      });
    }

    function moveCard(cardId, fromColId, toColId) {
      if (fromColId === toColId) return;
      const fromCol = board.columns.find(c => c.id === fromColId);
      const toCol = board.columns.find(c => c.id === toColId);
      if (!fromCol || !toCol) return;
      const idx = fromCol.cards.findIndex(c => c.id === cardId);
      if (idx === -1) return;
      const [card] = fromCol.cards.splice(idx, 1);
      toCol.cards.push(card);
      render();
      save();
    }

    async function save() {
      await KinBot.storage.set('board', board);
    }

    KinBot.on('app-meta', async () => {
      const stored = await KinBot.storage.get('board');
      if (stored && stored.columns) board = stored;
      render();
    });
    KinBot.ready();
  </script>
</body>
</html>`,
    },
  },
]

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
