# KinBot — Contrats API

Toutes les routes retournent du JSON. Les erreurs suivent le format standard :

```json
{ "error": { "code": "ERROR_CODE", "message": "Description lisible" } }
```

Authentification : cookie HTTP-only géré par Better Auth, vérifié par middleware sur toutes les routes `/api/*` (sauf `/api/auth/*`).

---

## Auth

### `POST /api/auth/register`

Créé automatiquement par Better Auth.

```typescript
// Request
{ name: string, email: string, password: string }

// Response 200
{ user: { id: string, name: string, email: string }, session: { token: string } }
```

### `POST /api/auth/login`

```typescript
// Request
{ email: string, password: string }

// Response 200
{ user: { id: string, name: string, email: string }, session: { token: string } }
```

### `POST /api/auth/logout`

```typescript
// Response 200
{ success: true }
```

---

## Onboarding

### `GET /api/onboarding/status`

Vérifie si l'onboarding a été complété (au moins un user + providers avec llm et embedding).

```typescript
// Response 200
{ completed: boolean, hasAdmin: boolean, hasLlm: boolean, hasEmbedding: boolean }
```

---

## Compte

### `GET /api/me`

```typescript
// Response 200
{
  id: string
  email: string
  firstName: string
  lastName: string
  pseudonym: string
  language: 'fr' | 'en'
  role: 'admin' | 'user'
  avatarUrl: string | null
}
```

### `PATCH /api/me`

```typescript
// Request (tous les champs optionnels)
{
  firstName?: string
  lastName?: string
  pseudonym?: string
  language?: 'fr' | 'en'
  password?: { current: string, new: string }
}

// Response 200
{ ...same as GET /api/me }
```

### `POST /api/me/avatar`

Upload multipart/form-data.

```typescript
// Request: FormData avec champ "file"

// Response 200
{ avatarUrl: string }
```

---

## Providers

### `GET /api/providers`

```typescript
// Response 200
{
  providers: Array<{
    id: string
    name: string
    type: 'anthropic' | 'openai' | 'gemini' | 'voyage_ai'
    capabilities: ('llm' | 'embedding' | 'image')[]
    isValid: boolean
    createdAt: number
  }>
}
```

### `POST /api/providers`

```typescript
// Request
{
  name: string
  type: 'anthropic' | 'openai' | 'gemini' | 'voyage_ai'
  config: { apiKey: string, baseUrl?: string }
}

// Response 201
{ provider: { id: string, name: string, type: string, capabilities: string[], isValid: boolean } }
```

> Le serveur teste la connexion et détecte les capacités avant de retourner.

### `PATCH /api/providers/:id`

```typescript
// Request (tous optionnels)
{ name?: string, config?: { apiKey?: string, baseUrl?: string } }

// Response 200
{ provider: { ...same shape } }
```

### `DELETE /api/providers/:id`

```typescript
// Response 200
{ success: true }

// Error 409 si c'est le dernier provider couvrant une capacité requise (llm ou embedding)
{ error: { code: "PROVIDER_REQUIRED", message: "..." } }
```

### `POST /api/providers/:id/test`

Teste la connexion au provider.

```typescript
// Response 200
{ valid: boolean, capabilities: string[], error?: string }
```

### `GET /api/providers/models`

Liste tous les modèles disponibles a travers tous les providers configurés.

```typescript
// Response 200
{
  models: Array<{
    id: string              // ex: 'claude-sonnet-4-20250514'
    name: string            // ex: 'Claude Sonnet 4'
    providerId: string
    providerType: string
    capability: 'llm' | 'embedding'
  }>
}
```

---

## Kins

### `GET /api/kins`

```typescript
// Response 200
{
  kins: Array<{
    id: string
    name: string
    role: string
    avatarUrl: string | null
    model: string
    createdAt: number
    // Pas de character/expertise ici (trop volumineux pour la liste)
  }>
}
```

### `GET /api/kins/:id`

```typescript
// Response 200
{
  id: string
  name: string
  role: string
  avatarUrl: string | null
  character: string
  expertise: string
  model: string
  workspacePath: string
  mcpServers: Array<{ id: string, name: string }>
  queueSize: number          // nombre de messages en attente
  isProcessing: boolean      // en train de traiter un message
  createdAt: number
}
```

### `POST /api/kins`

```typescript
// Request
{
  name: string
  role: string
  character: string
  expertise: string
  model: string
  mcpServerIds?: string[]
  avatar?: 'upload' | 'generate' | 'prompt'
  avatarPrompt?: string       // si avatar === 'prompt'
}

// Si avatar === 'upload', utiliser POST /api/kins/:id/avatar après création

// Response 201
{ kin: { ...same as GET /api/kins/:id } }
```

### `PATCH /api/kins/:id`

```typescript
// Request (tous optionnels)
{
  name?: string
  role?: string
  character?: string
  expertise?: string
  model?: string
  mcpServerIds?: string[]
}

// Response 200
{ kin: { ...same shape } }
```

### `DELETE /api/kins/:id`

```typescript
// Response 200
{ success: true }
```

### `POST /api/kins/:id/avatar`

Upload ou génération d'avatar.

```typescript
// Mode upload : FormData avec champ "file"
// Mode generate : { mode: 'generate' }
// Mode prompt : { mode: 'prompt', prompt: string }

// Response 200
{ avatarUrl: string }
```

### `GET /api/kins/:id/context-preview`

Reconstruit et retourne le contexte LLM complet tel qu'il serait envoyé au modèle.
Utile pour le debugging et la transparence. Accepte des query params optionnels pour les tâches et sessions rapides.

```typescript
// Query params optionnels :
// ?taskId={string}     — contexte d'une tâche spécifique
// ?sessionId={string}  — contexte d'une session rapide

// Response 200
{
  systemPrompt: string           // Prompt système complet (avec outils en annexe)
  compactingSummary: string | null // Résumé de compacting (null si pas de compacting)
  rawPayload: {
    system: string
    messages: Array<{
      role: string
      content: string | null
      hasToolCalls: boolean
      createdAt: number | null
    }>
    tools: Array<{
      name: string
      description: string
      parameters: Record<string, unknown> | null
    }>
  }
  tokenEstimate: {
    systemPrompt: number
    summary: number
    messages: number
    tools: number
    total: number
  }
  contextWindow: number          // Taille max du contexte du modèle (en tokens)
  messageCount: number
  generatedAt: number
}
```

---

## Messages / Chat

### `POST /api/kins/:id/messages`

Envoie un message a un Kin. Déclenche le traitement et le streaming SSE de la réponse.

```typescript
// Request
{
  content: string
  files?: string[]          // IDs de fichiers déjà uploadés
}

// Response 202
{ messageId: string, queuePosition: number }
```

> La réponse du Kin arrive via SSE (pas dans cette response HTTP).

### `GET /api/kins/:id/messages`

Historique paginé des messages.

```typescript
// Query params : ?before={messageId}&limit={number, default 50}

// Response 200
{
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    sourceType: 'user' | 'kin' | 'task' | 'cron' | 'system'
    sourceId: string | null
    sourceName: string | null   // pseudonym, kin name, task name, cron name
    isRedacted: boolean
    files: Array<{ id: string, name: string, mimeType: string, url: string }>
    createdAt: number
  }>
  hasMore: boolean
}
```

---

## Tâches

### `GET /api/tasks`

Liste toutes les tâches en cours.

```typescript
// Query params : ?status={pending|in_progress|completed|failed|cancelled}&kinId={string}

// Response 200
{
  tasks: Array<{
    id: string
    parentKinId: string
    parentKinName: string
    description: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
    mode: 'await' | 'async'
    depth: number
    createdAt: number
    updatedAt: number
  }>
}
```

### `GET /api/tasks/:id`

Détail d'une tâche avec ses messages.

```typescript
// Response 200
{
  task: { ...same as list item + result: string | null, error: string | null }
  messages: Array<{ ...same as message shape }>
}
```

### `POST /api/tasks/:id/cancel`

```typescript
// Response 200
{ success: true }
```

---

## Crons

### `GET /api/crons`

```typescript
// Query params : ?kinId={string}

// Response 200
{
  crons: Array<{
    id: string
    kinId: string
    kinName: string
    name: string
    schedule: string
    taskDescription: string
    targetKinId: string | null
    model: string | null
    isActive: boolean
    requiresApproval: boolean
    lastTriggeredAt: number | null
    createdAt: number
  }>
}
```

### `POST /api/crons`

```typescript
// Request
{
  kinId: string
  name: string
  schedule: string
  taskDescription: string
  targetKinId?: string
  model?: string
}

// Response 201
{ cron: { ...same shape } }
```

### `PATCH /api/crons/:id`

```typescript
// Request (tous optionnels)
{
  name?: string
  schedule?: string
  taskDescription?: string
  targetKinId?: string
  model?: string
  isActive?: boolean
}

// Response 200
{ cron: { ...same shape } }
```

### `DELETE /api/crons/:id`

```typescript
// Response 200
{ success: true }
```

### `POST /api/crons/:id/approve`

Approuve un cron créé par un Kin (qui nécessite validation).

```typescript
// Response 200
{ cron: { ...same shape, requiresApproval: false, isActive: true } }
```

---

## MCP Servers

### `GET /api/mcp-servers`

```typescript
// Response 200
{
  servers: Array<{
    id: string
    name: string
    command: string
    args: string[]
    env: Record<string, string> | null
    createdAt: number
  }>
}
```

### `POST /api/mcp-servers`

```typescript
// Request
{ name: string, command: string, args?: string[], env?: Record<string, string> }

// Response 201
{ server: { ...same shape } }
```

### `DELETE /api/mcp-servers/:id`

```typescript
// Response 200
{ success: true }
```

---

## Vault

### `GET /api/vault`

Liste les secrets (clés uniquement, jamais les valeurs).

```typescript
// Response 200
{
  secrets: Array<{
    id: string
    key: string
    createdAt: number
    updatedAt: number
  }>
}
```

### `POST /api/vault`

```typescript
// Request
{ key: string, value: string }

// Response 201
{ secret: { id: string, key: string, createdAt: number } }
```

### `PATCH /api/vault/:id`

```typescript
// Request
{ key?: string, value?: string }

// Response 200
{ secret: { id: string, key: string, updatedAt: number } }
```

### `DELETE /api/vault/:id`

```typescript
// Response 200
{ success: true }
```

---

## Files

### `POST /api/files/upload`

Upload multipart/form-data.

```typescript
// Request: FormData avec champ "file" + "kinId"

// Response 201
{ file: { id: string, name: string, mimeType: string, size: number, url: string } }
```

---

## Memories (gestion via UI)

### `GET /api/kins/:id/memories`

```typescript
// Query params : ?category={fact|preference|decision|knowledge}&subject={string}&limit={number}

// Response 200
{
  memories: Array<{
    id: string
    content: string
    category: 'fact' | 'preference' | 'decision' | 'knowledge'
    subject: string | null
    sourceChannel: 'automatic' | 'explicit'
    createdAt: number
    updatedAt: number
  }>
}
```

### `DELETE /api/kins/:id/memories/:memoryId`

```typescript
// Response 200
{ success: true }
```

---

## Compacting (gestion via UI)

### `POST /api/kins/:id/compacting/purge`

Réinitialise le compacting (supprime le snapshot actif).

```typescript
// Response 200
{ success: true }
```

### `GET /api/kins/:id/compacting/snapshots`

Liste les snapshots pour le rollback.

```typescript
// Response 200
{
  snapshots: Array<{
    id: string
    messagesUpToId: string
    isActive: boolean
    createdAt: number
  }>
}
```

### `POST /api/kins/:id/compacting/rollback`

```typescript
// Request
{ snapshotId: string }

// Response 200
{ success: true }
```

---

## SSE

### `GET /api/sse`

Connexion SSE **globale** (une seule par client). Le serveur multiplex les événements de tous les Kins.

#### Types d'événements

```typescript
// Tokens LLM en streaming
{ event: 'chat:token', data: { kinId: string, token: string } }

// Réponse LLM terminée
{ event: 'chat:done', data: { kinId: string, messageId: string } }

// Nouveau message dans le chat (autres sources)
{ event: 'chat:message', data: { kinId: string, message: MessageShape } }

// Changement d'état d'une tâche
{ event: 'task:status', data: { taskId: string, kinId: string, status: string } }

// Tâche terminée
{ event: 'task:done', data: { taskId: string, kinId: string, result: string } }

// Exécution d'un cron
{ event: 'cron:triggered', data: { cronId: string, kinId: string, taskId: string } }

// Queue mise a jour
{ event: 'queue:update', data: { kinId: string, queueSize: number, isProcessing: boolean } }

// Erreur sur un Kin
{ event: 'kin:error', data: { kinId: string, error: string } }
```

> Le SSE est **global** (pas par Kin). Le client filtre côté frontend par `kinId` pour n'afficher que les événements pertinents. Cela permet de mettre a jour la sidebar (badges, statuts) pour tous les Kins simultanément.
