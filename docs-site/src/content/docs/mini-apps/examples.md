---
title: Examples
description: Complete mini-app examples to learn from.
---

## Todo List

A persistent todo app with add, complete, and delete functionality.

```jsx
<div id="root"></div>
<script type="text/jsx">
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useKinBot, useStorage, toast } from "@kinbot/react";
import { Card, Input, Button, List, Stack, EmptyState, Badge } from "@kinbot/components";

function App() {
  const { ready } = useKinBot();
  if (!ready) return <div className="p-4"><div className="spinner" /></div>;
  return <TodoApp />;
}

function TodoApp() {
  const [todos, setTodos, loading] = useStorage("todos", []);
  const [input, setInput] = useState("");

  if (loading) return <div className="p-4"><div className="spinner" /></div>;

  const addTodo = () => {
    if (!input.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: input.trim(), done: false }]);
    setInput("");
    toast("Added!", "success");
  };

  const toggle = (id) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const remove = (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  const pending = todos.filter(t => !t.done).length;

  return (
    <div className="p-4 space-y-4">
      <Stack direction="row" gap="8px">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add a task..."
          onKeyDown={e => e.key === "Enter" && addTodo()}
          style={{ flex: 1 }}
        />
        <Button variant="primary" onClick={addTodo}>Add</Button>
      </Stack>

      {todos.length === 0 ? (
        <EmptyState icon="📝" title="No tasks yet" description="Add your first task above" />
      ) : (
        <>
          <Badge>{pending} pending</Badge>
          <List divided items={todos.map(t => ({
            primary: <span style={{ textDecoration: t.done ? "line-through" : "none", opacity: t.done ? 0.5 : 1 }}>{t.text}</span>,
            icon: t.done ? "✅" : "⬜",
            action: (
              <Stack direction="row" gap="4px">
                <Button size="sm" variant="ghost" onClick={() => toggle(t.id)}>{t.done ? "Undo" : "Done"}</Button>
                <Button size="sm" variant="danger" onClick={() => remove(t.id)}>×</Button>
              </Stack>
            ),
          }))} />
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
</script>
```

## Dashboard with Charts

A dashboard showing stats and charts with mock data.

```jsx
<div id="root"></div>
<script type="text/jsx">
import { createRoot } from "react-dom/client";
import { useKinBot } from "@kinbot/react";
import { Card, Stat, Grid, BarChart, LineChart, PieChart, Stack } from "@kinbot/components";

function App() {
  const { ready } = useKinBot();
  if (!ready) return <div>Loading...</div>;
  return <Dashboard />;
}

function Dashboard() {
  return (
    <div className="p-4 space-y-4">
      <Grid columns={2} gap="12px">
        <Stat value="1,234" label="Users" trend="+12%" trendUp />
        <Stat value="567" label="Orders" trend="+5%" trendUp />
        <Stat value="89%" label="Uptime" />
        <Stat value="$12.3k" label="Revenue" trend="-2%" />
      </Grid>

      <Card>
        <Card.Header><Card.Title>Monthly Sales</Card.Title></Card.Header>
        <Card.Content>
          <BarChart
            data={[
              { label: "Jan", value: 65 }, { label: "Feb", value: 59 },
              { label: "Mar", value: 80 }, { label: "Apr", value: 81 },
              { label: "May", value: 56 }, { label: "Jun", value: 95 },
            ]}
            showValues
            animate
          />
        </Card.Content>
      </Card>

      <Grid columns={2} gap="12px">
        <Card>
          <Card.Header><Card.Title>Trend</Card.Title></Card.Header>
          <Card.Content>
            <LineChart
              data={[
                { label: "W1", value: 30 }, { label: "W2", value: 45 },
                { label: "W3", value: 38 }, { label: "W4", value: 52 },
              ]}
              showDots curved showArea animate
            />
          </Card.Content>
        </Card>

        <Card>
          <Card.Header><Card.Title>Distribution</Card.Title></Card.Header>
          <Card.Content>
            <PieChart
              data={[
                { label: "Desktop", value: 55 },
                { label: "Mobile", value: 35 },
                { label: "Tablet", value: 10 },
              ]}
              donut showLegend animate
            />
          </Card.Content>
        </Card>
      </Grid>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
</script>
```

## Form with Validation

Using the compound Form component.

```jsx
<div id="root"></div>
<script type="text/jsx">
import { createRoot } from "react-dom/client";
import { useKinBot, useStorage, toast } from "@kinbot/react";
import { Card, Form, Input, Select, Textarea, Switch } from "@kinbot/components";

function App() {
  const { ready } = useKinBot();
  if (!ready) return <div>Loading...</div>;
  return <ContactForm />;
}

function ContactForm() {
  const [contacts, setContacts] = useStorage("contacts", []);

  const handleSubmit = (values) => {
    setContacts(prev => [...prev, { id: Date.now(), ...values }]);
    toast("Contact saved!", "success");
  };

  return (
    <div className="p-4">
      <Card>
        <Card.Header><Card.Title>New Contact</Card.Title></Card.Header>
        <Card.Content>
          <Form onSubmit={handleSubmit} initialValues={{ name: "", email: "", category: "personal", notes: "" }}>
            <Form.Field name="name" label="Name" rules={["required", { type: "minLength", value: 2 }]}>
              <Input placeholder="John Doe" />
            </Form.Field>
            <Form.Field name="email" label="Email" rules={["required", "email"]}>
              <Input type="email" placeholder="john@example.com" />
            </Form.Field>
            <Form.Field name="category" label="Category">
              <Select options={[
                { value: "personal", label: "Personal" },
                { value: "work", label: "Work" },
                { value: "other", label: "Other" },
              ]} />
            </Form.Field>
            <Form.Field name="notes" label="Notes">
              <Textarea placeholder="Any additional notes..." rows={3} />
            </Form.Field>
            <Form.Actions>
              <Form.Reset variant="ghost">Clear</Form.Reset>
              <Form.Submit loadingText="Saving...">Save Contact</Form.Submit>
            </Form.Actions>
          </Form>
        </Card.Content>
      </Card>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
</script>
```

## Multi-Page App with Routing

Using hash-based routing for a settings app.

```jsx
<div id="root"></div>
<script type="text/jsx">
import { createRoot } from "react-dom/client";
import { useKinBot, useStorage } from "@kinbot/react";
import { Router, Route, NavLink, Card, Stack, Switch, Select, Input } from "@kinbot/components";

function App() {
  const { ready } = useKinBot();
  if (!ready) return <div>Loading...</div>;

  return (
    <Router>
      <div className="p-4 space-y-4">
        <Stack direction="row" gap="8px">
          <NavLink to="/" exact>General</NavLink>
          <NavLink to="/appearance">Appearance</NavLink>
          <NavLink to="/notifications">Notifications</NavLink>
        </Stack>
        <Route path="/" element={<GeneralSettings />} />
        <Route path="/appearance" element={<AppearanceSettings />} />
        <Route path="/notifications" element={<NotificationSettings />} />
      </div>
    </Router>
  );
}

function GeneralSettings() {
  const [name, setName] = useStorage("settings.name", "");
  return (
    <Card>
      <Card.Header><Card.Title>General</Card.Title></Card.Header>
      <Card.Content>
        <Input label="Display Name" value={name} onChange={e => setName(e.target.value)} />
      </Card.Content>
    </Card>
  );
}

function AppearanceSettings() {
  const [compact, setCompact] = useStorage("settings.compact", false);
  return (
    <Card>
      <Card.Header><Card.Title>Appearance</Card.Title></Card.Header>
      <Card.Content>
        <Switch label="Compact mode" checked={compact} onChange={setCompact} />
      </Card.Content>
    </Card>
  );
}

function NotificationSettings() {
  return (
    <Card>
      <Card.Header><Card.Title>Notifications</Card.Title></Card.Header>
      <Card.Content><p>Coming soon...</p></Card.Content>
    </Card>
  );
}

createRoot(document.getElementById("root")).render(<App />);
</script>
```

## Templates

KinBot includes built-in templates for common patterns. Ask a Kin:

> "Create a mini-app using the kanban template"

Available templates: `dashboard`, `todo-list`, `form`, `data-viewer`, `kanban`, `responsive`.

Use `get_mini_app_templates` to see all templates with descriptions and full source code.
