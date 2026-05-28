---
title: Components
description: 50+ themed React components from @kinbot/components.
---

Import from `@kinbot/components` after adding it to your `app.json` dependencies:

```json
{
  "dependencies": {
    "@kinbot/components": "/api/mini-apps/sdk/kinbot-components.js"
  }
}
```

All components auto-adapt to light/dark theme.

## ⚠️ Pièges courants

- **Pour un titre autonome, le composant s'appelle `Heading`** (pas `Title`). Il n'existe **pas** de composant `Title` à importer : à l'intérieur d'une `Card`, utilisez `Card.Title` ; partout ailleurs, utilisez `Heading`.
- **Pour du texte, utilisez `Text`** (ou du HTML natif `<p>`/`<span>`). `Card.Description` reste réservé au sous-titre d'une `Card`.
- Les sous-composants de `Card` s'utilisent en notation point : `Card.Header`, `Card.Title`, `Card.Description`, `Card.Content`, `Card.Footer`.

## Typography

### Heading

Standalone, theme-aware title. Renders a real `<h1>`–`<h6>` via `as`.

```jsx
<Heading as="h1">Page title</Heading>
<Heading as="h2" size="md" weight="bold" align="center">Section</Heading>
```

| Prop | Type | Default |
|------|------|---------|
| `as` | `"h1"`–`"h6"` | `"h2"` |
| `size` | `"sm" \| "md" \| "lg" \| "xl" \| "2xl"` | derived from `as` |
| `weight` | `"normal" \| "medium" \| "semibold" \| "bold"` | `"semibold"` |
| `align` | `"left" \| "center" \| "right"` | — |

### Text

Theme-aware text block. Prefer this over a raw `<p>`/`<span>` so the color follows the theme.

```jsx
<Text>Body copy.</Text>
<Text as="span" size="sm" muted>Secondary label</Text>
```

| Prop | Type | Default |
|------|------|---------|
| `as` | `"p" \| "span" \| "div" \| "label"` | `"p"` |
| `size` | `"xs" \| "sm" \| "md" \| "lg"` | `"md"` |
| `weight` | `"normal" \| "medium" \| "semibold" \| "bold"` | `"normal"` |
| `muted` | `boolean` | `false` |
| `align` | `"left" \| "center" \| "right"` | — |

> Inside a `Card`, use `Card.Title` / `Card.Description` instead — they carry the card-specific spacing.

## Layout

### Stack

Flexbox container.

```jsx
<Stack direction="row" gap="8px" align="center" justify="between" wrap>
  <Button>A</Button>
  <Button>B</Button>
</Stack>
```

| Prop | Type | Default |
|------|------|---------|
| `direction` | `"row" \| "column"` | `"column"` |
| `gap` | `string` | — |
| `align` | CSS `alignItems` | — |
| `justify` | CSS `justifyContent` | — |
| `wrap` | `boolean` | `false` |

### Grid

CSS Grid with auto-fit support.

```jsx
<Grid columns={3} gap="16px">
  <Grid.Item colSpan={2}>Wide</Grid.Item>
  <Grid.Item>Normal</Grid.Item>
</Grid>

{/* Responsive auto-fit */}
<Grid minChildWidth="250px" gap="16px">
  <Card>...</Card>
  <Card>...</Card>
</Grid>
```

### Divider

```jsx
<Divider orientation="horizontal" />
```

## Card

```jsx
<Card hover>
  <Card.Header>
    <Card.Title>Title</Card.Title>
    <Card.Description>Subtitle</Card.Description>
  </Card.Header>
  <Card.Content>Body</Card.Content>
  <Card.Footer>
    <Button>Action</Button>
  </Card.Footer>
</Card>
```

## Panel

Collapsible panel with title bar.

```jsx
<Panel title="Settings" icon="⚙️" collapsible defaultOpen actions={<Button size="sm">Reset</Button>} variant="outlined">
  Content here
</Panel>
```

Variants: `default`, `outlined`, `filled`.

## Buttons

```jsx
<Button variant="primary" size="md" loading={false}>Click me</Button>
<ButtonGroup>
  <Button>Left</Button>
  <Button>Right</Button>
</ButtonGroup>
```

Variants: `primary`, `secondary`, `outline`, `ghost`, `danger`, `success`, `warning`.
Sizes: `sm`, `md`, `lg`.

## Form Inputs

### Input, Textarea, Select

All support `label` and `error` props for form validation.

```jsx
<Input label="Name" error={errors.name} value={name} onChange={e => setName(e.target.value)} />
<Textarea label="Bio" rows={4} />
<Select label="Country" options={[{value: "fr", label: "France"}]} />
```

### Checkbox & Switch

```jsx
<Checkbox label="Accept terms" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
<Switch label="Dark mode" checked={dark} onChange={setDark} />
```

### RadioGroup

```jsx
<RadioGroup
  label="Size"
  options={[{value: "s", label: "Small"}, {value: "m", label: "Medium"}, {value: "l", label: "Large"}]}
  value={size}
  onChange={setSize}
  direction="row"
/>
```

### Slider

```jsx
<Slider label="Volume" value={vol} onChange={setVol} min={0} max={100} showValue formatValue={v => `${v}%`} />
```

### DatePicker

```jsx
<DatePicker label="Date" type="date" value={date} onChange={setDate} min="2024-01-01" />
```

Types: `date`, `datetime-local`, `time`.

### NumberInput

Numeric stepper with +/- buttons.

```jsx
<NumberInput label="Quantity" value={qty} onChange={setQty} min={1} max={99} step={1} size="md" />
```

### Combobox

Searchable select dropdown with keyboard navigation.

```jsx
<Combobox
  label="Country"
  options={[{value: "fr", label: "France", icon: "🇫🇷"}]}
  value={country}
  onChange={setCountry}
  clearable
  placeholder="Search..."
/>
```

### TagInput

Multi-tag entry field.

```jsx
<TagInput
  label="Tags"
  value={tags}
  onChange={setTags}
  suggestions={["react", "typescript", "css"]}
  maxTags={5}
/>
```

### ColorPicker

Full color picker with saturation/brightness area, hue slider, and hex input.

```jsx
<ColorPicker label="Color" value={color} onChange={setColor} swatches={["#ff0000", "#00ff00"]} />
```

### MarkdownEditor

Markdown editor with toolbar, live preview, and split view.

```jsx
<MarkdownEditor value={md} onChange={setMd} showPreview showToolbar minHeight={200} />
```

### Calendar

Visual month calendar with single, multiple, or range selection.

```jsx
<Calendar mode="range" value={range} onChange={setRange} events={[{date: "2024-03-15", color: "red", label: "Deadline"}]} />
```

### DateRangePicker

Two-input field with Calendar popover. Supports presets.

```jsx
<DateRangePicker
  label="Period"
  value={range}
  onChange={setRange}
  presets={[{label: "Last 7 days", start: "2024-03-01", end: "2024-03-07"}]}
/>
```

## Form (Compound)

Full form with validation.

```jsx
<Form onSubmit={handleSubmit} initialValues={{name: "", email: ""}}>
  <Form.Field name="name" label="Name" rules={["required", {type: "minLength", value: 2}]}>
    <Input />
  </Form.Field>
  <Form.Field name="email" label="Email" rules={["required", "email"]}>
    <Input type="email" />
  </Form.Field>
  <Form.Actions>
    <Form.Reset variant="ghost">Reset</Form.Reset>
    <Form.Submit loadingText="Saving...">Save</Form.Submit>
  </Form.Actions>
</Form>
```

**Validation rules:** `"required"`, `"email"`, `{type: "minLength", value, message?}`, `{type: "maxLength", value}`, `{type: "min", value}`, `{type: "max", value}`, `{type: "pattern", value: /regex/}`, `{type: "match", value: "fieldName"}`, or a custom function `(value, allValues) => string | null`.

## Data Display

### Badge & Tag

```jsx
<Badge variant="success">Active</Badge>
<Tag onRemove={() => remove(id)}>React</Tag>
```

Badge variants: `default`, `success`, `warning`, `error`, `info`.

### Stat

```jsx
<Stat value="1,234" label="Users" trend="+12%" trendUp />
```

### Avatar & AvatarGroup

```jsx
<Avatar src="/photo.jpg" alt="User" />
<Avatar initials="NV" size={40} />
<AvatarGroup avatars={[{src: "/a.jpg"}, {name: "Bob"}]} max={3} size="md" />
```

### Tooltip

```jsx
<Tooltip text="More info" position="top">
  <Button>Hover me</Button>
</Tooltip>
```

### ProgressBar

```jsx
<ProgressBar value={65} max={100} showLabel />
```

## Tables & Lists

### Table

```jsx
<Table
  columns={[
    {key: "name", label: "Name"},
    {key: "status", label: "Status", render: (v) => <Badge>{v}</Badge>},
  ]}
  data={items}
  onRowClick={(row) => select(row)}
/>
```

### DataGrid

Feature-rich data table with sorting, filtering, search, pagination, and selection.

```jsx
<DataGrid
  columns={[
    {key: "name", label: "Name", sortable: true, filterable: true},
    {key: "email", label: "Email", sortable: true},
    {key: "role", label: "Role", filterable: true},
  ]}
  data={users}
  pageSize={10}
  pageSizeOptions={[10, 25, 50]}
  searchable
  selectable
  onSelectionChange={setSelected}
  striped
/>
```

Use `DataGrid` instead of `Table` + `Pagination` for data-heavy apps.

### List

```jsx
<List divided items={[
  {primary: "Item 1", secondary: "Description", icon: "📦", action: <Button size="sm">Edit</Button>},
]} />
```

## Navigation

### Tabs

```jsx
<Tabs
  tabs={[{id: "general", label: "General"}, {id: "advanced", label: "Advanced", badge: 3}]}
  active={tab}
  onChange={setTab}
/>
```

### Pagination

```jsx
<Pagination page={page} totalPages={10} onChange={setPage} />
```

### Breadcrumbs

```jsx
<Breadcrumbs items={[{label: "Home", onClick: goHome}, {label: "Settings"}]} />
```

## Overlays

### Modal

```jsx
<Modal open={open} onClose={() => setOpen(false)} title="Confirm" size="sm">
  <p>Are you sure?</p>
  <Button onClick={confirm}>Yes</Button>
</Modal>
```

Sizes: `sm`, `md`, `lg`, `xl`.

### Drawer

```jsx
<Drawer open={open} onClose={close} title="Details" side="right" width="400px">
  Content
</Drawer>
```

### Popover

```jsx
<Popover trigger={<Button>Menu</Button>} content={<div>Popover content</div>} placement="bottom" />
```

## Accordion & Dropdown

### Accordion

```jsx
<Accordion
  items={[{id: "1", title: "Section 1", content: <p>Content</p>}]}
  multiple
  defaultOpen={["1"]}
/>
```

### DropdownMenu

```jsx
<DropdownMenu
  trigger={<Button>Actions</Button>}
  items={[
    {label: "Edit", icon: "✏️", onClick: edit},
    {divider: true},
    {label: "Delete", danger: true, onClick: del},
  ]}
/>
```

## Charts

All charts use `--color-chart-1` through `--color-chart-5` CSS variables for theme-aware colors.

### BarChart

```jsx
<BarChart data={[{label: "Jan", value: 100}, {label: "Feb", value: 150}]} showValues animate />
```

### LineChart

```jsx
{/* Single series */}
<LineChart data={[{label: "Mon", value: 10}, {label: "Tue", value: 20}]} showDots curved />

{/* Multi-series */}
<LineChart data={[{label: "Mon", values: [10, 15]}, {label: "Tue", values: [20, 18]}]} series={["Sales", "Returns"]} showArea />
```

### PieChart

```jsx
<PieChart data={[{label: "A", value: 30}, {label: "B", value: 70}]} donut showLabels showLegend />
```

### SparkLine

```jsx
<SparkLine data={[5, 10, 8, 15, 12]} width={100} height={30} showArea />
```

## Stepper

Multi-step wizards.

```jsx
<Stepper
  steps={[{label: "Account"}, {label: "Profile"}, {label: "Review"}]}
  activeStep={step}
  onStepClick={setStep}
/>
<StepperContent activeStep={step} animated>
  <AccountForm />
  <ProfileForm />
  <ReviewPage />
</StepperContent>
```

## Miscellaneous

### FileUpload

```jsx
<FileUpload accept="image/*" multiple maxSize={5_000_000} maxFiles={3} onFiles={handleFiles} onError={alert} />
```

### CodeBlock

```jsx
<CodeBlock code={jsonString} language="json" showCopy showLineNumbers maxHeight="300px" />
```

### Timeline

```jsx
<Timeline items={[
  {title: "Created", time: "9:00 AM", icon: "🎉", color: "green"},
  {title: "Updated", time: "2:00 PM", description: "Changed status"},
]} />
```

### Kanban

Drag-and-drop kanban board.

```jsx
<Kanban
  columns={[
    {id: "todo", title: "To Do", cards: [{id: "1", title: "Task 1", priority: "high", tags: ["bug"]}]},
    {id: "done", title: "Done", cards: []},
  ]}
  onChange={setCols}
  onCardClick={(card) => openDetail(card)}
  allowAddCards
  allowEditCards
/>
```

## Routing {#routing}

Hash-based routing for multi-page apps.

```jsx
import { Router, Route, NavLink, useHashRouter } from "@kinbot/components";

function App() {
  return (
    <Router>
      <nav>
        <NavLink to="/" exact>Home</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <Route path="/" element={<Home />} />
      <Route path="/users/:id" element={<UserDetail />} />
      <Route path="*" element={<NotFound />} />
    </Router>
  );
}
```

Components: `Router`, `Route` (path + element), `Link`, `NavLink` (adds `active` class), `Navigate` (redirect).
Hook: `useHashRouter()` returns `{ path, params, query, navigate }`.
