#!/usr/bin/env bun
/**
 * create-kinbot-plugin — scaffold a new KinBot plugin.
 *
 * Usage:
 *   bunx create-kinbot-plugin
 *   bunx create-kinbot-plugin --yes            # non-interactive with defaults
 *   bunx create-kinbot-plugin --name my-plugin  # partial overrides
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { createInterface } from 'readline'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScaffoldOptions {
  name: string
  description: string
  author: string
  types: PluginType[]
}

export type PluginType = 'tools' | 'providers' | 'channels' | 'hooks'

const ALL_PLUGIN_TYPES: PluginType[] = ['tools', 'providers', 'channels', 'hooks']

const DEFAULTS: ScaffoldOptions = {
  name: 'my-plugin',
  description: 'A KinBot plugin',
  author: 'Your Name',
  types: ['tools'],
}

// ─── CLI argument parsing ────────────────────────────────────────────────────

function parseArgs(argv: string[]): { yes: boolean; overrides: Partial<ScaffoldOptions> } {
  let yes = false
  const overrides: Partial<ScaffoldOptions> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--yes' || arg === '-y') {
      yes = true
    } else if ((arg === '--name' || arg === '-n') && argv[i + 1]) {
      overrides.name = argv[++i]
    } else if ((arg === '--description' || arg === '-d') && argv[i + 1]) {
      overrides.description = argv[++i]
    } else if ((arg === '--author' || arg === '-a') && argv[i + 1]) {
      overrides.author = argv[++i]
    } else if ((arg === '--types' || arg === '-t') && argv[i + 1]) {
      overrides.types = argv[++i].split(',').filter(t => ALL_PLUGIN_TYPES.includes(t as PluginType)) as PluginType[]
    }
  }

  return { yes, overrides }
}

// ─── Interactive prompt ──────────────────────────────────────────────────────

async function prompt(question: string, defaultValue: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(`${question} (${defaultValue}): `, (answer) => {
      rl.close()
      resolve(answer.trim() || defaultValue)
    })
  })
}

async function promptTypes(): Promise<PluginType[]> {
  const answer = await prompt(
    'Plugin types (comma-separated: tools,providers,channels,hooks)',
    'tools'
  )
  const types = answer.split(',').map(t => t.trim()).filter(t => ALL_PLUGIN_TYPES.includes(t as PluginType)) as PluginType[]
  return types.length > 0 ? types : ['tools']
}

async function gatherOptions(yes: boolean, overrides: Partial<ScaffoldOptions>): Promise<ScaffoldOptions> {
  if (yes) {
    return { ...DEFAULTS, ...overrides }
  }

  const name = overrides.name ?? await prompt('Plugin name', DEFAULTS.name)
  const description = overrides.description ?? await prompt('Description', DEFAULTS.description)
  const author = overrides.author ?? await prompt('Author', DEFAULTS.author)
  const types = overrides.types ?? await promptTypes()

  return { name, description, author, types }
}

// ─── File generators ─────────────────────────────────────────────────────────

export function generateManifest(opts: ScaffoldOptions): string {
  const manifest: Record<string, any> = {
    name: opts.name,
    version: '1.0.0',
    description: opts.description,
    author: opts.author,
    kinbot: '>=0.10.0',
    main: 'index.ts',
    permissions: ['storage'],
    config: {},
  }
  return JSON.stringify(manifest, null, 2) + '\n'
}

export function generateIndex(opts: ScaffoldOptions): string {
  const lines: string[] = [
    `import type { PluginContext, PluginExports } from 'kinbot/plugin'`,
  ]

  if (opts.types.includes('tools')) {
    lines.push(`import { tool } from 'ai'`)
    lines.push(`import { z } from 'zod'`)
  }

  lines.push('')
  lines.push(`export default function(ctx: PluginContext): PluginExports {`)
  lines.push(`  return {`)

  if (opts.types.includes('tools')) {
    lines.push(`    tools: {`)
    lines.push(`      hello: {`)
    lines.push(`        availability: ['main', 'sub-kin'],`)
    lines.push(`        create: () =>`)
    lines.push(`          tool({`)
    lines.push(`            description: 'A sample tool from ${opts.name}',`)
    lines.push(`            inputSchema: z.object({`)
    lines.push(`              name: z.string().describe('Name to greet'),`)
    lines.push(`            }),`)
    lines.push(`            execute: async ({ name }) => {`)
    lines.push(`              return { message: \`Hello, \${name}! From ${opts.name}\` }`)
    lines.push(`            },`)
    lines.push(`          }),`)
    lines.push(`      },`)
    lines.push(`    },`)
  }

  if (opts.types.includes('providers')) {
    lines.push(`    providers: {`)
    lines.push(`      // Add your provider definitions here`)
    lines.push(`    },`)
  }

  if (opts.types.includes('channels')) {
    lines.push(`    channels: {`)
    lines.push(`      // Add your channel adapters here`)
    lines.push(`    },`)
  }

  if (opts.types.includes('hooks')) {
    lines.push(`    hooks: {`)
    lines.push(`      afterChat: async (hookCtx) => {`)
    lines.push(`        ctx.log.info('afterChat hook fired')`)
    lines.push(`      },`)
    lines.push(`    },`)
  }

  lines.push('')
  lines.push(`    async activate() {`)
  lines.push(`      ctx.log.info('${opts.name} activated')`)
  lines.push(`    },`)
  lines.push('')
  lines.push(`    async deactivate() {`)
  lines.push(`      ctx.log.info('${opts.name} deactivated')`)
  lines.push(`    },`)
  lines.push(`  }`)
  lines.push(`}`)
  lines.push('')

  return lines.join('\n')
}

export function generateReadme(opts: ScaffoldOptions): string {
  return `# ${opts.name}

${opts.description}

## Installation

Copy this folder into your KinBot \`plugins/\` directory:

\`\`\`bash
git clone <your-repo-url> plugins/${opts.name}
\`\`\`

Then go to **Settings → Plugins** and enable it.

## Configuration

Edit the plugin settings in the KinBot UI under **Settings → Plugins → ${opts.name}**.

## Plugin Types

This plugin provides: ${opts.types.join(', ')}

## Development

See the [KinBot Plugin Development Guide](https://github.com/MarlBurroW/kinbot/blob/main/PLUGIN-DEVELOPMENT.md) for details.

## License

MIT
`
}

export function generateGitignore(): string {
  return `node_modules/
*.log
.DS_Store
`
}

// ─── Scaffold function ───────────────────────────────────────────────────────

export function scaffold(targetDir: string, opts: ScaffoldOptions): void {
  if (existsSync(targetDir)) {
    throw new Error(`Directory "${targetDir}" already exists.`)
  }

  mkdirSync(targetDir, { recursive: true })
  writeFileSync(join(targetDir, 'plugin.json'), generateManifest(opts))
  writeFileSync(join(targetDir, 'index.ts'), generateIndex(opts))
  writeFileSync(join(targetDir, 'README.md'), generateReadme(opts))
  writeFileSync(join(targetDir, '.gitignore'), generateGitignore())
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🔌 Create KinBot Plugin\n')

  const { yes, overrides } = parseArgs(process.argv.slice(2))
  const opts = await gatherOptions(yes, overrides)

  const targetDir = resolve(process.cwd(), opts.name)
  scaffold(targetDir, opts)

  console.log(`\n✅ Plugin scaffolded at: ${targetDir}`)
  console.log(`\nNext steps:`)
  console.log(`  1. cd ${opts.name}`)
  console.log(`  2. Edit plugin.json to add permissions and config`)
  console.log(`  3. Implement your plugin in index.ts`)
  console.log(`  4. Copy to KinBot's plugins/ directory`)
  console.log(`  5. Enable in Settings → Plugins\n`)
}

// Only run main when executed directly (not imported for tests)
const isDirectRun = process.argv[1]?.endsWith('create-kinbot-plugin/index.ts') ||
                    process.argv[1]?.endsWith('create-kinbot-plugin')

if (isDirectRun) {
  main().catch((err) => {
    console.error('Error:', err.message)
    process.exit(1)
  })
}
