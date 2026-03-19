import { eq } from 'drizzle-orm'
import { db } from '@/server/db/index'
import { providers } from '@/server/db/schema'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_NAME_LENGTH = 100
const MAX_ROLE_LENGTH = 200
const MAX_TEXT_LENGTH = 50_000

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ValidationError {
  code: string
  message: string
  field: string
}

export interface KinFieldsInput {
  name?: string
  role?: string
  character?: string
  expertise?: string
  model?: string
  providerId?: string | null
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateKinFields(
  fields: KinFieldsInput,
  mode: 'create' | 'update',
): ValidationError | null {
  const { name, role, character, expertise, model, providerId } = fields

  if (mode === 'create') {
    if (!name || !name.trim()) return { code: 'INVALID_NAME', message: 'Name is required', field: 'name' }
    if (!role || !role.trim()) return { code: 'INVALID_ROLE', message: 'Role is required', field: 'role' }
    if (!model || !model.trim()) return { code: 'INVALID_MODEL', message: 'Model is required', field: 'model' }
  }

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return { code: 'INVALID_NAME', message: 'Name cannot be empty', field: 'name' }
    if (name.length > MAX_NAME_LENGTH) return { code: 'INVALID_NAME', message: `Name must be under ${MAX_NAME_LENGTH} characters`, field: 'name' }
  }
  if (role !== undefined) {
    if (typeof role !== 'string' || !role.trim()) return { code: 'INVALID_ROLE', message: 'Role cannot be empty', field: 'role' }
    if (role.length > MAX_ROLE_LENGTH) return { code: 'INVALID_ROLE', message: `Role must be under ${MAX_ROLE_LENGTH} characters`, field: 'role' }
  }
  if (character !== undefined && typeof character === 'string' && character.length > MAX_TEXT_LENGTH) {
    return { code: 'INVALID_CHARACTER', message: `Character must be under ${MAX_TEXT_LENGTH} characters`, field: 'character' }
  }
  if (expertise !== undefined && typeof expertise === 'string' && expertise.length > MAX_TEXT_LENGTH) {
    return { code: 'INVALID_EXPERTISE', message: `Expertise must be under ${MAX_TEXT_LENGTH} characters`, field: 'expertise' }
  }
  if (model !== undefined && (typeof model !== 'string' || !model.trim())) {
    return { code: 'INVALID_MODEL', message: 'Model cannot be empty', field: 'model' }
  }

  // Validate providerId exists if specified
  if (providerId !== undefined && providerId !== null) {
    const provider = db.select({ id: providers.id }).from(providers).where(eq(providers.id, providerId)).get()
    if (!provider) return { code: 'INVALID_PROVIDER', message: 'Provider not found', field: 'providerId' }
  }

  return null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function kinAvatarUrl(kinId: string, avatarPath: string | null, updatedAt?: Date | null): string | null {
  if (!avatarPath) return null
  const ext = avatarPath.split('.').pop() ?? 'png'
  const v = updatedAt ? updatedAt.getTime() : Date.now()
  return `/api/uploads/kins/${kinId}/avatar.${ext}?v=${v}`
}
