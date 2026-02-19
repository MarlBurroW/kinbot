import { useState } from 'react'
import {
  Sun,
  Moon,
  AlertCircle,
  CheckCircle,
  Info,
  AlertTriangle,
  Bell,
  Search,
  Send,
  Settings,
  User,
  Bot,
  Clock,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Copy,
  Pencil,
  Sparkles,
  Zap,
} from 'lucide-react'

import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import { Textarea } from '@/client/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/client/components/ui/card'
import { Badge } from '@/client/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/client/components/ui/alert'
import { Checkbox } from '@/client/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/client/components/ui/radio-group'
import { Switch } from '@/client/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/client/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/client/components/ui/tooltip'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/client/components/ui/avatar'
import { Label } from '@/client/components/ui/label'
import { Separator } from '@/client/components/ui/separator'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
      </div>
      {children}
    </section>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </div>
  )
}

function ColorSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`size-16 rounded-xl shadow-sm ring-1 ring-black/5 ${className}`} />
      <span className="text-xs font-medium">{name}</span>
    </div>
  )
}

function GradientSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`h-16 w-28 rounded-xl shadow-md ${className}`} />
      <span className="text-xs font-medium">{name}</span>
    </div>
  )
}

export function DesignSystemPage() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [dialogOpen, setDialogOpen] = useState(false)

  function toggleDarkMode() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground">
        {/* ─── HERO HEADER ──────────────────────────────────── */}
        <header className="sticky top-0 z-50 glass-strong">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="gradient-primary flex size-10 items-center justify-center rounded-xl">
                <Sparkles className="size-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold gradient-primary-text">KinBot Design System</h1>
                <p className="text-xs text-muted-foreground">Gradient Vivid &mdash; Premium modern UI</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleDarkMode} className="gap-2">
              {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {isDark ? 'Light' : 'Dark'}
            </Button>
          </div>
        </header>

        {/* ─── HERO BANNER ──────────────────────────────────── */}
        <div className="relative overflow-hidden border-b">
          <div className="absolute inset-0 gradient-primary opacity-[0.04]" />
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-5xl font-bold tracking-tight gradient-primary-text">
              Gradient Vivid
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              Vibrant violet-to-peach gradients, glassmorphism surfaces, and a premium modern feel.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Button className="gradient-primary border-0 text-white shadow-lg glow-primary">
                <Zap className="size-4" /> Get Started
              </Button>
              <Button variant="outline" className="glass">
                Learn More
              </Button>
            </div>
          </div>
        </div>

        <main className="mx-auto max-w-6xl space-y-16 px-6 py-12">

          {/* ─── COLOR PALETTE ─────────────────────────────── */}
          <Section title="Color Palette">
            <SubSection title="Primary & Accent">
              <div className="flex flex-wrap gap-4">
                <ColorSwatch name="Primary" className="bg-primary" />
                <ColorSwatch name="Primary FG" className="bg-primary-foreground ring-border" />
                <ColorSwatch name="Secondary" className="bg-secondary" />
                <ColorSwatch name="Accent" className="bg-accent" />
                <ColorSwatch name="Ring" className="bg-ring" />
              </div>
            </SubSection>

            <SubSection title="Gradients">
              <div className="flex flex-wrap gap-4">
                <GradientSwatch name="Primary" className="gradient-primary" />
                <GradientSwatch name="Hover" className="gradient-primary-hover" />
                <GradientSwatch name="Subtle" className="gradient-subtle" />
              </div>
            </SubSection>

            <SubSection title="Semantic">
              <div className="flex flex-wrap gap-4">
                <ColorSwatch name="Success" className="bg-success" />
                <ColorSwatch name="Warning" className="bg-warning" />
                <ColorSwatch name="Destructive" className="bg-destructive" />
                <ColorSwatch name="Info" className="bg-info" />
              </div>
            </SubSection>

            <SubSection title="Surfaces">
              <div className="flex flex-wrap gap-4">
                <ColorSwatch name="Background" className="bg-background ring-border" />
                <ColorSwatch name="Card" className="bg-card ring-border" />
                <ColorSwatch name="Muted" className="bg-muted" />
                <ColorSwatch name="Sidebar" className="bg-sidebar ring-border" />
                <div className="flex flex-col items-center gap-2">
                  <div className="glass size-16 rounded-xl" />
                  <span className="text-xs font-medium">Glass</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="glass-strong size-16 rounded-xl" />
                  <span className="text-xs font-medium">Glass Strong</span>
                </div>
              </div>
            </SubSection>

            <SubSection title="Text">
              <div className="space-y-2 rounded-xl bg-card p-4">
                <p className="text-foreground font-semibold">Foreground &mdash; Primary text for headings and body</p>
                <p className="text-muted-foreground">Muted foreground &mdash; Secondary text, descriptions, hints</p>
                <p className="text-primary font-semibold">Primary &mdash; Links, accents, interactive elements</p>
                <p className="gradient-primary-text font-bold text-lg">Gradient text &mdash; Hero titles, brand elements</p>
                <p className="text-destructive">Destructive &mdash; Errors and warnings</p>
              </div>
            </SubSection>

            <SubSection title="Chat Bubbles">
              <div className="flex flex-wrap gap-4">
                <ColorSwatch name="User" className="bg-bubble-user" />
                <ColorSwatch name="Kin" className="bg-bubble-kin ring-border" />
                <ColorSwatch name="System" className="bg-bubble-system ring-border" />
              </div>
            </SubSection>
          </Section>

          {/* ─── TYPOGRAPHY ──────────────────────────────────── */}
          <Section title="Typography">
            <SubSection title="Headings (Plus Jakarta Sans)">
              <div className="space-y-3 rounded-xl bg-card p-6">
                <h1 className="text-4xl font-bold tracking-tight">Heading 1 &mdash; Bold statement</h1>
                <h2 className="text-3xl font-bold tracking-tight">Heading 2 &mdash; Section title</h2>
                <h3 className="text-2xl font-semibold">Heading 3 &mdash; Subsection</h3>
                <h4 className="text-xl font-semibold">Heading 4 &mdash; Card title</h4>
                <h5 className="text-lg font-medium">Heading 5 &mdash; Label</h5>
                <h6 className="text-base font-medium">Heading 6 &mdash; Small label</h6>
              </div>
            </SubSection>

            <SubSection title="Body Text">
              <div className="space-y-2 rounded-xl bg-card p-6">
                <p className="text-lg">Large body (text-lg) &mdash; Perfect for intros and descriptions.</p>
                <p className="text-base">Default body (text-base) &mdash; The main reading size across the app.</p>
                <p className="text-sm">Small text (text-sm) &mdash; For secondary information and metadata.</p>
                <p className="text-xs text-muted-foreground">Caption (text-xs) &mdash; Timestamps, counters, fine print.</p>
              </div>
            </SubSection>

            <SubSection title="Font Weights">
              <div className="space-y-1 rounded-xl bg-card p-6">
                <p className="font-normal">Regular (400) &mdash; Lorem ipsum dolor sit amet</p>
                <p className="font-medium">Medium (500) &mdash; Lorem ipsum dolor sit amet</p>
                <p className="font-semibold">Semibold (600) &mdash; Lorem ipsum dolor sit amet</p>
                <p className="font-bold">Bold (700) &mdash; Lorem ipsum dolor sit amet</p>
              </div>
            </SubSection>
          </Section>

          {/* ─── BUTTONS ─────────────────────────────────────── */}
          <Section title="Buttons">
            <SubSection title="Standard Variants">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button variant="link">Link</Button>
              </div>
            </SubSection>

            <SubSection title="Gradient Buttons">
              <div className="flex flex-wrap items-center gap-3">
                <Button className="gradient-primary border-0 text-white shadow-lg glow-primary">
                  <Sparkles className="size-4" /> Gradient CTA
                </Button>
                <Button className="gradient-primary-hover border-0 text-white shadow-lg">
                  <Zap className="size-4" /> Animated Gradient
                </Button>
                <Button variant="outline" className="gradient-border">
                  Gradient Border
                </Button>
              </div>
            </SubSection>

            <SubSection title="Sizes">
              <div className="flex flex-wrap items-center gap-3">
                <Button size="xs">Extra Small</Button>
                <Button size="sm">Small</Button>
                <Button size="default">Default</Button>
                <Button size="lg">Large</Button>
              </div>
            </SubSection>

            <SubSection title="With Icons">
              <div className="flex flex-wrap items-center gap-3">
                <Button><Plus className="size-4" /> Create Kin</Button>
                <Button variant="outline"><Settings className="size-4" /> Settings</Button>
                <Button variant="destructive"><Trash2 className="size-4" /> Delete</Button>
                <Button variant="ghost" size="icon"><Bell className="size-4" /></Button>
                <Button variant="ghost" size="icon-sm"><Search className="size-4" /></Button>
              </div>
            </SubSection>

            <SubSection title="States">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <Button disabled>Disabled</Button>
                <Button disabled><Loader2 className="size-4 animate-spin" /> Loading...</Button>
              </div>
            </SubSection>
          </Section>

          {/* ─── INPUTS ──────────────────────────────────────── */}
          <Section title="Inputs">
            <div className="grid gap-8 lg:grid-cols-2">
              <SubSection title="Text Input">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="input-default">Default</Label>
                    <Input id="input-default" placeholder="Type something..." />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-with-value">With value</Label>
                    <Input id="input-with-value" defaultValue="Hello KinBot" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-error">Error state</Label>
                    <Input id="input-error" aria-invalid="true" defaultValue="invalid@" />
                    <p className="text-sm text-destructive">Please enter a valid email address</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-disabled">Disabled</Label>
                    <Input id="input-disabled" disabled placeholder="Not editable" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="input-icon">With icon</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="input-icon" className="pl-9" placeholder="Search memories..." />
                    </div>
                  </div>
                </div>
              </SubSection>

              <div className="space-y-8">
                <SubSection title="Textarea">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="textarea-default">Message</Label>
                      <Textarea id="textarea-default" placeholder="Describe your Kin's personality..." />
                    </div>
                  </div>
                </SubSection>

                <SubSection title="Select">
                  <div className="space-y-2">
                    <Label>LLM Model</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude">Claude Sonnet 4</SelectItem>
                        <SelectItem value="gpt4">GPT-4o</SelectItem>
                        <SelectItem value="gemini">Gemini 2.5 Pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SubSection>
              </div>
            </div>
          </Section>

          {/* ─── CARDS ───────────────────────────────────────── */}
          <Section title="Cards">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Card</CardTitle>
                  <CardDescription>Standard card with content.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Clean, minimal design with subtle shadow.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Card with Footer</CardTitle>
                  <CardDescription>Includes action buttons.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Interactive card pattern for forms and settings.
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button size="sm" className="gradient-primary border-0 text-white">Save</Button>
                  <Button variant="outline" size="sm">Cancel</Button>
                </CardFooter>
              </Card>

              <Card className="glass cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" /> Glass Card
                  </CardTitle>
                  <CardDescription>Glassmorphism effect with hover.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Frosted glass aesthetic with scale-up on hover.
                  </p>
                </CardContent>
              </Card>

              <Card className="gradient-border overflow-hidden">
                <CardHeader>
                  <CardTitle className="gradient-primary-text">Gradient Border</CardTitle>
                  <CardDescription>Eye-catching accent card.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Uses the brand gradient as a border highlight.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 gradient-primary opacity-[0.04]" />
                <CardHeader className="relative">
                  <CardTitle>Tinted Card</CardTitle>
                  <CardDescription>Subtle gradient background tint.</CardDescription>
                </CardHeader>
                <CardContent className="relative">
                  <p className="text-sm text-muted-foreground">
                    A gentle gradient wash for featured content.
                  </p>
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* ─── BADGES ──────────────────────────────────────── */}
          <Section title="Badges">
            <SubSection title="Variants">
              <div className="flex flex-wrap items-center gap-3">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </SubSection>

            <SubSection title="Semantic">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-success text-success-foreground">Success</Badge>
                <Badge className="bg-warning text-warning-foreground">Warning</Badge>
                <Badge className="bg-destructive text-destructive-foreground">Error</Badge>
                <Badge className="bg-info text-info-foreground">Info</Badge>
                <Badge className="gradient-primary text-white border-0">Gradient</Badge>
              </div>
            </SubSection>

            <SubSection title="Use Cases">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">Queue: 3</Badge>
                <Badge className="bg-success text-success-foreground">Online</Badge>
                <Badge className="bg-warning text-warning-foreground">
                  <Loader2 className="size-3 animate-spin" /> Processing
                </Badge>
                <Badge variant="outline">v1.0.0</Badge>
                <Badge className="gradient-primary text-white border-0">
                  <Sparkles className="size-3" /> Premium
                </Badge>
              </div>
            </SubSection>
          </Section>

          {/* ─── ALERTS ──────────────────────────────────────── */}
          <Section title="Alerts">
            <div className="max-w-2xl space-y-4">
              <Alert>
                <Info className="size-4" />
                <AlertTitle>Info</AlertTitle>
                <AlertDescription>
                  Your Kin is learning from your conversation patterns.
                </AlertDescription>
              </Alert>

              <Alert className="border-success/50 text-success [&>svg]:text-success">
                <CheckCircle className="size-4" />
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>
                  Anthropic provider connected and validated.
                </AlertDescription>
              </Alert>

              <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
                <AlertTriangle className="size-4" />
                <AlertTitle>Warning</AlertTitle>
                <AlertDescription>
                  No embedding provider configured. Memory search will be limited.
                </AlertDescription>
              </Alert>

              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  API key invalid. Please check your provider settings.
                </AlertDescription>
              </Alert>
            </div>
          </Section>

          {/* ─── FORM CONTROLS ───────────────────────────────── */}
          <Section title="Checkboxes, Radios, Switches">
            <div className="grid gap-8 sm:grid-cols-3">
              <SubSection title="Checkboxes">
                <div className="space-y-3 rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Checkbox id="check-1" defaultChecked />
                    <Label htmlFor="check-1">Remember me</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="check-2" />
                    <Label htmlFor="check-2">Accept terms</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox id="check-3" disabled />
                    <Label htmlFor="check-3" className="text-muted-foreground">Disabled</Label>
                  </div>
                </div>
              </SubSection>

              <SubSection title="Radio Buttons">
                <div className="rounded-xl bg-card p-4">
                  <RadioGroup defaultValue="claude">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="claude" id="radio-claude" />
                      <Label htmlFor="radio-claude">Claude</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="gpt" id="radio-gpt" />
                      <Label htmlFor="radio-gpt">GPT-4</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="gemini" id="radio-gemini" />
                      <Label htmlFor="radio-gemini">Gemini</Label>
                    </div>
                  </RadioGroup>
                </div>
              </SubSection>

              <SubSection title="Switches">
                <div className="space-y-3 rounded-xl bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Switch id="switch-dark" defaultChecked />
                    <Label htmlFor="switch-dark">Dark mode</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="switch-notif" />
                    <Label htmlFor="switch-notif">Notifications</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch id="switch-disabled" disabled />
                    <Label htmlFor="switch-disabled" className="text-muted-foreground">Disabled</Label>
                  </div>
                </div>
              </SubSection>
            </div>
          </Section>

          {/* ─── DIALOG ──────────────────────────────────────── */}
          <Section title="Dialog / Modal">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary border-0 text-white">
                  <Plus className="size-4" /> Create a Kin
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-strong">
                <DialogHeader>
                  <DialogTitle className="gradient-primary-text">Create a new Kin</DialogTitle>
                  <DialogDescription>
                    Give your AI assistant a name, role, and personality.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="dialog-name">Name</Label>
                    <Input id="dialog-name" placeholder="e.g. Financial Advisor" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dialog-role">Role</Label>
                    <Input id="dialog-role" placeholder="e.g. Expert in personal finance" />
                  </div>
                  <div className="space-y-2">
                    <Label>Model</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a model" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="claude">Claude Sonnet 4</SelectItem>
                        <SelectItem value="gpt4">GPT-4o</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button className="gradient-primary border-0 text-white" onClick={() => setDialogOpen(false)}>
                    <Sparkles className="size-4" /> Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>

          {/* ─── TABS, DROPDOWN, TOOLTIP ─────────────────────── */}
          <Section title="Tabs, Dropdown, Tooltip">
            <div className="grid gap-8 lg:grid-cols-2">
              <SubSection title="Tabs">
                <Tabs defaultValue="chat" className="w-full">
                  <TabsList>
                    <TabsTrigger value="chat">Chat</TabsTrigger>
                    <TabsTrigger value="memory">Memory</TabsTrigger>
                    <TabsTrigger value="tools">Tools</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>
                  <TabsContent value="chat" className="mt-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">
                    Main chat interface with streaming responses.
                  </TabsContent>
                  <TabsContent value="memory" className="mt-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">
                    Memory entries and semantic search.
                  </TabsContent>
                  <TabsContent value="tools" className="mt-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">
                    Tool configuration, MCP servers, custom tools.
                  </TabsContent>
                  <TabsContent value="settings" className="mt-3 rounded-lg bg-card p-4 text-sm text-muted-foreground">
                    Kin configuration and preferences.
                  </TabsContent>
                </Tabs>
              </SubSection>

              <div className="space-y-8">
                <SubSection title="Dropdown Menu">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <MoreHorizontal className="size-4" /> Actions
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem><Pencil className="mr-2 size-4" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem><Copy className="mr-2 size-4" /> Duplicate</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SubSection>

                <SubSection title="Tooltips">
                  <div className="flex gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon"><Settings className="size-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>Settings</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon"><Bell className="size-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>Notifications</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon"><Info className="size-4" /></Button>
                      </TooltipTrigger>
                      <TooltipContent>More info</TooltipContent>
                    </Tooltip>
                  </div>
                </SubSection>
              </div>
            </div>
          </Section>

          {/* ─── AVATARS ─────────────────────────────────────── */}
          <Section title="Avatars">
            <SubSection title="Sizes">
              <div className="flex items-end gap-5">
                {([
                  { size: 'size-6', text: 'text-[10px]', label: 'XS' },
                  { size: 'size-8', text: 'text-xs', label: 'SM' },
                  { size: 'size-10', text: 'text-sm', label: 'MD' },
                  { size: 'size-12', text: 'text-base', label: 'LG' },
                  { size: 'size-16', text: 'text-lg', label: 'XL' },
                ] as const).map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-1.5">
                    <Avatar className={item.size}>
                      <AvatarFallback className={`gradient-primary text-white ${item.text}`}>KB</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </SubSection>

            <SubSection title="With Status Indicator">
              <div className="flex items-center gap-8">
                {([
                  { status: 'Online', color: 'bg-success' },
                  { status: 'Offline', color: 'bg-muted-foreground' },
                  { status: 'Busy', color: 'bg-warning animate-pulse' },
                ] as const).map((item) => (
                  <div key={item.status} className="flex flex-col items-center gap-1.5">
                    <div className="relative">
                      <Avatar className="size-10">
                        <AvatarFallback className="gradient-primary text-white">
                          <Bot className="size-5" />
                        </AvatarFallback>
                      </Avatar>
                      <span className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-background ${item.color}`} />
                    </div>
                    <span className="text-xs text-muted-foreground">{item.status}</span>
                  </div>
                ))}
              </div>
            </SubSection>
          </Section>

          {/* ─── KINBOT PATTERNS ──────────────────────────────── */}
          <Section title="KinBot Patterns">

            {/* Message Bubbles */}
            <SubSection title="Message Bubbles">
              <div className="max-w-2xl space-y-4 rounded-xl bg-card p-6">
                {/* User message */}
                <div className="flex justify-end gap-2.5">
                  <div className="max-w-[75%] space-y-1">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">Nicolas</span>
                      <span className="text-xs text-muted-foreground">14:32</span>
                    </div>
                    <div className="gradient-primary rounded-2xl rounded-br-md px-4 py-2.5 text-white shadow-sm">
                      <p className="text-sm">Can you analyze my monthly expenses and suggest optimizations?</p>
                    </div>
                  </div>
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="bg-secondary text-xs">
                      <User className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Kin message */}
                <div className="flex gap-2.5">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="gradient-primary text-white text-xs">
                      <Bot className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="max-w-[75%] space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Financial Advisor</span>
                      <span className="text-xs text-muted-foreground">14:32</span>
                    </div>
                    <div className="rounded-2xl rounded-bl-md bg-bubble-kin px-4 py-2.5 text-bubble-kin-foreground shadow-sm">
                      <p className="text-sm">
                        Of course! I can see three areas where we could optimize:
                        subscriptions, dining, and transportation. Want a detailed breakdown?
                      </p>
                    </div>
                  </div>
                </div>

                {/* System message */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-1.5 rounded-full bg-bubble-system px-4 py-1.5 text-bubble-system-foreground">
                    <CheckCircle className="size-3" />
                    <p className="text-xs">Task &ldquo;Expense Analysis&rdquo; completed</p>
                  </div>
                </div>

                {/* Cron message */}
                <div className="flex justify-center">
                  <div className="flex items-center gap-1.5 rounded-full bg-bubble-system px-4 py-1.5 text-bubble-system-foreground">
                    <Clock className="size-3" />
                    <p className="text-xs">Scheduled report generated at 09:00</p>
                  </div>
                </div>
              </div>
            </SubSection>

            {/* Kin Card */}
            <SubSection title="Kin Card (Sidebar)">
              <div className="max-w-xs space-y-1 rounded-xl bg-sidebar p-2">
                {/* Active */}
                <div className="flex cursor-pointer items-center gap-3 rounded-lg bg-sidebar-accent p-3 transition-all">
                  <div className="relative">
                    <Avatar className="size-10">
                      <AvatarFallback className="gradient-primary text-white">
                        <Bot className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-sidebar-accent bg-success" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold">Financial Advisor</p>
                      <Badge variant="secondary" className="ml-2 text-[10px]">2</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">Expert in personal finance</p>
                  </div>
                </div>

                {/* Idle */}
                <div className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all hover:bg-sidebar-accent">
                  <div className="relative">
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-secondary text-secondary-foreground">
                        <Bot className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-sidebar bg-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">Coding Assistant</p>
                    <p className="truncate text-xs text-muted-foreground">Full-stack developer</p>
                  </div>
                </div>

                {/* Processing */}
                <div className="flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-all hover:bg-sidebar-accent">
                  <div className="relative">
                    <Avatar className="size-10">
                      <AvatarFallback className="gradient-primary text-white">
                        <Bot className="size-5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-sidebar bg-warning animate-pulse" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-medium">Research Agent</p>
                      <Badge className="ml-2 bg-warning text-warning-foreground text-[10px]">
                        <Loader2 className="size-3 animate-spin" />
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">Processing task...</p>
                  </div>
                </div>
              </div>
            </SubSection>

            {/* Typing Indicator */}
            <SubSection title="Typing / Streaming Indicator">
              <div className="max-w-2xl rounded-xl bg-card p-6">
                <div className="flex gap-2.5">
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback className="gradient-primary text-white text-xs">
                      <Bot className="size-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <span className="text-xs font-medium">Financial Advisor</span>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-bubble-kin px-4 py-3">
                      <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                      <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                      <span className="size-2 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              </div>
            </SubSection>

            {/* Task Status */}
            <SubSection title="Task Status Indicators">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <div className="size-2 rounded-full bg-muted-foreground" />
                  <span className="text-sm">Pending</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <Loader2 className="size-4 animate-spin text-warning" />
                  <span className="text-sm">In Progress</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 p-3">
                  <CheckCircle className="size-4 text-success" />
                  <span className="text-sm">Completed</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="size-4 text-destructive" />
                  <span className="text-sm">Failed</span>
                </div>
              </div>
            </SubSection>
          </Section>

          {/* ─── GLASSMORPHISM SHOWCASE ───────────────────────── */}
          <Section title="Glassmorphism & Effects">
            <div className="relative overflow-hidden rounded-2xl gradient-subtle p-8">
              {/* Background decorative blobs */}
              <div className="absolute -top-20 -left-20 size-60 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-20 -right-20 size-60 rounded-full bg-accent/30 blur-3xl" />

              <div className="relative grid gap-6 sm:grid-cols-3">
                <div className="glass rounded-xl p-6 text-center">
                  <Bot className="mx-auto size-8 text-primary" />
                  <h4 className="mt-3 font-semibold">Glass Card</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Standard glass effect</p>
                </div>
                <div className="glass-strong rounded-xl p-6 text-center">
                  <Sparkles className="mx-auto size-8 text-primary" />
                  <h4 className="mt-3 font-semibold">Glass Strong</h4>
                  <p className="mt-1 text-sm text-muted-foreground">More opaque frosted glass</p>
                </div>
                <div className="gradient-border rounded-xl bg-card p-6 text-center">
                  <Zap className="mx-auto size-8 text-primary" />
                  <h4 className="mt-3 font-semibold">Gradient Border</h4>
                  <p className="mt-1 text-sm text-muted-foreground">Animated gradient outline</p>
                </div>
              </div>

              <div className="relative mt-6 flex items-center justify-center gap-4">
                <div className="glow-primary gradient-primary rounded-full px-6 py-2 text-sm font-medium text-white">
                  Glow Primary
                </div>
                <div className="glow-accent rounded-full bg-accent px-6 py-2 text-sm font-medium text-accent-foreground">
                  Glow Accent
                </div>
              </div>
            </div>
          </Section>

          {/* ─── SPACING & LAYOUT ────────────────────────────── */}
          <Section title="Spacing & Layout">
            <div className="grid gap-8 lg:grid-cols-3">
              <SubSection title="Spacing Scale">
                <div className="space-y-2">
                  {[
                    { label: '4px', cls: 'w-1' },
                    { label: '8px', cls: 'w-2' },
                    { label: '12px', cls: 'w-3' },
                    { label: '16px', cls: 'w-4' },
                    { label: '24px', cls: 'w-6' },
                    { label: '32px', cls: 'w-8' },
                    { label: '48px', cls: 'w-12' },
                    { label: '64px', cls: 'w-16' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-10 text-right text-xs text-muted-foreground">{item.label}</span>
                      <div className={`h-4 rounded-sm gradient-primary ${item.cls}`} />
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Border Radius">
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'sm', cls: 'rounded-sm' },
                    { label: 'md', cls: 'rounded-md' },
                    { label: 'lg', cls: 'rounded-lg' },
                    { label: 'xl', cls: 'rounded-xl' },
                    { label: '2xl', cls: 'rounded-2xl' },
                    { label: 'full', cls: 'rounded-full' },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-1.5">
                      <div className={`size-14 border-2 border-primary/30 bg-primary/10 ${item.cls}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </SubSection>

              <SubSection title="Shadows">
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: 'sm', cls: 'shadow-sm' },
                    { label: 'md', cls: 'shadow-md' },
                    { label: 'lg', cls: 'shadow-lg' },
                  ].map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-1.5">
                      <div className={`size-16 rounded-xl bg-card ${item.cls}`} />
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </div>
                  ))}
                </div>
              </SubSection>
            </div>
          </Section>

          {/* ─── DARK MODE ───────────────────────────────────── */}
          <Section title="Dark Mode">
            <Card className="glass max-w-2xl">
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Toggle the theme with the button below. Dark mode uses deep violet/navy tones
                  (no pure black) with slightly brighter accent colors for comfortable reading.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <Button variant="outline" size="sm" onClick={toggleDarkMode}>
                    {isDark ? <Sun className="mr-2 size-4" /> : <Moon className="mr-2 size-4" />}
                    Switch to {isDark ? 'light' : 'dark'}
                  </Button>
                  <Badge variant={isDark ? 'default' : 'secondary'}>
                    {isDark ? 'Dark' : 'Light'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Section>

          {/* ─── FOOTER ──────────────────────────────────────── */}
          <div className="border-t pt-8 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="gradient-primary-text font-semibold">KinBot Design System</span>
              {' '}&mdash; Gradient Vivid theme. Dev only.
            </p>
          </div>
        </main>
      </div>
    </TooltipProvider>
  )
}
