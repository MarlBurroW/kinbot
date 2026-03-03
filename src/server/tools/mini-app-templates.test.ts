import { describe, it, expect } from 'bun:test'
import { getTemplateById, type MiniAppTemplate } from './mini-app-templates'

// We can't import TEMPLATES directly (not exported), but we can test via getTemplateById
// and validate structural invariants.

const KNOWN_TEMPLATE_IDS = [
  'dashboard',
  'todo-list',
  'form',
  'data-viewer',
  'kanban',
  'chat',
  'settings',
  'wizard',
  'component-showcase',
]

describe('getTemplateById', () => {
  it('returns undefined for unknown template id', () => {
    expect(getTemplateById('nonexistent')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getTemplateById('')).toBeUndefined()
  })

  it('is case-sensitive (uppercase id returns undefined)', () => {
    expect(getTemplateById('Dashboard')).toBeUndefined()
    expect(getTemplateById('DASHBOARD')).toBeUndefined()
  })

  for (const id of KNOWN_TEMPLATE_IDS) {
    it(`finds template "${id}"`, () => {
      const tmpl = getTemplateById(id)
      expect(tmpl).toBeDefined()
      expect(tmpl!.id).toBe(id)
    })
  }
})

describe('template structure', () => {
  for (const id of KNOWN_TEMPLATE_IDS) {
    describe(`template "${id}"`, () => {
      let tmpl: MiniAppTemplate

      // Fetch once per template
      it('exists', () => {
        tmpl = getTemplateById(id)!
        expect(tmpl).toBeDefined()
      })

      it('has required string fields', () => {
        tmpl = getTemplateById(id)!
        expect(typeof tmpl.id).toBe('string')
        expect(typeof tmpl.name).toBe('string')
        expect(typeof tmpl.description).toBe('string')
        expect(typeof tmpl.icon).toBe('string')
        expect(typeof tmpl.suggestedSlug).toBe('string')

        expect(tmpl.id.length).toBeGreaterThan(0)
        expect(tmpl.name.length).toBeGreaterThan(0)
        expect(tmpl.description.length).toBeGreaterThan(0)
        expect(tmpl.icon.length).toBeGreaterThan(0)
        expect(tmpl.suggestedSlug.length).toBeGreaterThan(0)
      })

      it('has non-empty tags array', () => {
        tmpl = getTemplateById(id)!
        expect(Array.isArray(tmpl.tags)).toBe(true)
        expect(tmpl.tags.length).toBeGreaterThan(0)
        for (const tag of tmpl.tags) {
          expect(typeof tag).toBe('string')
          expect(tag.length).toBeGreaterThan(0)
        }
      })

      it('has non-empty files record', () => {
        tmpl = getTemplateById(id)!
        expect(typeof tmpl.files).toBe('object')
        const fileNames = Object.keys(tmpl.files)
        expect(fileNames.length).toBeGreaterThan(0)
      })

      it('has an index.html entry file', () => {
        tmpl = getTemplateById(id)!
        const indexHtml = tmpl.files['index.html']
        expect(indexHtml).toBeDefined()
        expect(typeof indexHtml).toBe('string')
        expect(indexHtml!.length).toBeGreaterThan(0)
      })

      it('index.html contains valid HTML structure', () => {
        tmpl = getTemplateById(id)!
        const html = tmpl.files['index.html']
        expect(html).toContain('<!DOCTYPE html>')
        expect(html).toContain('<html')
        expect(html).toContain('</html>')
        expect(html).toContain('<head>')
        expect(html).toContain('</head>')
        expect(html).toContain('<body>')
        expect(html).toContain('</body>')
      })

      it('index.html has a root div for React mounting', () => {
        tmpl = getTemplateById(id)!
        const html = tmpl.files['index.html']
        expect(html).toContain('id="root"')
      })

      it('suggestedSlug is URL-safe (lowercase alphanumeric + hyphens)', () => {
        tmpl = getTemplateById(id)!
        expect(tmpl.suggestedSlug).toMatch(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/)
      })

      it('id matches suggestedSlug pattern (lowercase + hyphens)', () => {
        tmpl = getTemplateById(id)!
        expect(tmpl.id).toMatch(/^[a-z][a-z0-9-]*$/)
      })
    })
  }
})

describe('template uniqueness', () => {
  it('all template ids are unique', () => {
    const templates = KNOWN_TEMPLATE_IDS.map((id) => getTemplateById(id))
    const ids = templates.map((t) => t!.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('all template slugs are unique', () => {
    const templates = KNOWN_TEMPLATE_IDS.map((id) => getTemplateById(id))
    const slugs = templates.map((t) => t!.suggestedSlug)
    const uniqueSlugs = new Set(slugs)
    expect(uniqueSlugs.size).toBe(slugs.length)
  })

  it('all template names are unique', () => {
    const templates = KNOWN_TEMPLATE_IDS.map((id) => getTemplateById(id))
    const names = templates.map((t) => t!.name)
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(names.length)
  })
})

describe('template content quality', () => {
  it('all templates use React (import from react)', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      const html = tmpl.files['index.html']!
      // All templates use JSX scripts that import React
      expect(html).toContain('from \'react\'')
    }
  })

  it('all templates have app.json with dependencies', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      expect(tmpl.files['app.json']).toBeDefined()
      const appJson = JSON.parse(tmpl.files['app.json']!)
      expect(appJson.dependencies).toBeDefined()
      expect(typeof appJson.dependencies).toBe('object')
    }
  })

  it('app.json dependencies include react and react-dom', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      const appJson = JSON.parse(tmpl.files['app.json']!)
      expect(appJson.dependencies['react']).toBeDefined()
      expect(appJson.dependencies['react-dom/client']).toBeDefined()
    }
  })

  it('app.json dependencies include kinbot SDK', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      const appJson = JSON.parse(tmpl.files['app.json']!)
      expect(appJson.dependencies['@kinbot/react']).toBeDefined()
    }
  })

  it('all templates use createRoot for React 19 mounting', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      const html = tmpl.files['index.html']!
      expect(html).toContain('createRoot')
    }
  })

  it('descriptions are non-trivial (at least 20 chars)', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      expect(tmpl.description.length).toBeGreaterThanOrEqual(20)
    }
  })

  it('icons are emoji (single grapheme cluster)', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      // Icons should be short (1-2 characters or an emoji)
      expect(tmpl.icon.length).toBeLessThanOrEqual(4) // emoji can be up to 4 UTF-16 code units
      expect(tmpl.icon.length).toBeGreaterThan(0)
    }
  })
})

describe('file path safety', () => {
  it('no template file paths contain path traversal', () => {
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      for (const path of Object.keys(tmpl.files)) {
        expect(path).not.toContain('..')
        expect(path).not.toMatch(/^\//)
        expect(path).not.toContain('\\')
      }
    }
  })

  it('all file paths have valid extensions', () => {
    const validExtensions = ['.html', '.htm', '.css', '.js', '.ts', '.json', '.svg', '.md', '.txt']
    for (const id of KNOWN_TEMPLATE_IDS) {
      const tmpl = getTemplateById(id)!
      for (const path of Object.keys(tmpl.files)) {
        const ext = '.' + path.split('.').pop()!.toLowerCase()
        expect(validExtensions).toContain(ext)
      }
    }
  })
})
