# Feature "Teams" — Analyse fonctionnelle et technique

## 1. Analyse de l'existant

### 1.1 Communication inter-Kin actuelle

**Mécanisme** (`src/server/services/inter-kin.ts`) :
- Deux modes : `request` (enqueue → déclenche un tour LLM chez la cible, attend reply) et `inform` (insert direct en DB, pas de tour LLM)
- `reply()` renvoie une réponse au sender original via la queue
- Rate limiting in-memory par paire sender→target (configurable, par minute)
- Chain depth tracking pour éviter les boucles infinies (max configurable)
- `listAvailableKins()` retourne tous les Kins (flat list, pas de groupement)

**Limites actuelles :**
- **Pas de notion de groupe** : chaque Kin voit tous les autres, flat. Pas de "canal privé" entre Kins.
- **Pas de contexte partagé** : quand un Kin envoie un message à un autre, le destinataire n'a aucune visibilité sur la conversation d'origine.
- **Pas de routage intelligent** : le Hub actuel (`hub_kin_id` dans `appSettings`) est un simple flag qui enrichit le prompt du Kin désigné, mais c'est un singleton global — un seul Hub pour toute la plateforme.
- **Pas de mémoire/knowledge partagée** : chaque Kin a ses propres memories et knowledge sources (liées par `kinId`).

### 1.2 Schéma DB des Kins

Table `kins` : flat, pas de relation parent/enfant ni de groupement. Chaque Kin a :
- `id`, `slug`, `name`, `role`, `character`, `expertise`, `model`, `providerId`
- `toolConfig` (JSON deny/allow list)
- `workspacePath` (filesystem isolé)

Relations : messages, memories, knowledge sources, crons, tasks, channels, miniApps — tout indexé par `kinId`.

### 1.3 Patterns frontend

- **Sidebar** (`AppSidebar.tsx`) : tabs Kins / Tasks / Crons / MiniApps. KinList avec drag-and-drop (dnd-kit), search, hub badge.
- **KinCard** : affiche nom, rôle, avatar, badge Hub, état queue.
- **Navigation** : `react-router-dom`, sélection par slug (`/kin/:slug`).
- Pas de notion de section/groupe dans la sidebar actuellement.

### 1.4 Charge de travail estimée

**EPIC** — Feature transversale touchant DB, backend (services, tools, routes, engine, prompt), frontend (sidebar, navigation, nouveau UI), et logique LLM.

---

## 2. Design fonctionnel

### 2.1 Création d'une Team

**Via l'UI :**
- Bouton "Create Team" dans la sidebar (ou page Settings > Teams)
- Form : nom, description, icône/couleur, sélection du Hub Kin (parmi les Kins existants ou création d'un nouveau)
- Le Hub Kin est **obligatoire** — c'est le point d'entrée de la team

**Via un Kin (tool) :**
- Un Kin avec les droits peut créer une team via `create_team(name, description, hubKinId)`

### 2.2 Assignation des Kins à une Team

- Un Kin peut appartenir à **0 ou 1 team** (pour éviter les conflits de contexte) — OU à **plusieurs teams** (plus flexible, mais complexifie la mémoire partagée)
- **Recommandation : un Kin peut être dans plusieurs teams** mais n'a qu'un rôle par team. La mémoire partagée est scopée par team.
- Assignation via UI (drag-and-drop ou multiselect dans les settings de la team)
- Le Hub Kin est automatiquement membre de sa team

### 2.3 Hub / Superviseur

**Le Hub Kin d'une team reçoit un prompt enrichi :**
- Annuaire détaillé des membres de la team (avec expertise, rôle dans la team)
- Instructions de routage spécifiques à la team
- Accès à la mémoire partagée de la team
- Accès à la knowledge base partagée de la team

**Routage :**
- Pas de logique custom côté backend — tout passe par le prompt du Hub
- Le Hub utilise les tools inter-Kin existants (`send_message`, `spawn_kin`) pour déléguer
- Différence avec le Hub global : le Hub de team a un scope réduit (ses membres) et un contexte enrichi (mémoire/knowledge de team)

**Relation avec le Hub global :**
- Le Hub global existant peut coexister. Il peut router vers des teams entières (en parlant au Hub de team) ou vers des Kins individuels.
- Un Kin peut être Hub global ET Hub d'une team.

### 2.4 Interaction utilisateur

**Chat de Team :**
- L'utilisateur peut "parler à la team" → le message arrive au Hub Kin de la team
- Dans la sidebar, la team apparaît comme un groupe cliquable. Cliquer dessus ouvre le chat du Hub.
- Le Hub route, délègue, et synthétise les réponses.

**Chat individuel :**
- L'utilisateur peut toujours parler directement à n'importe quel Kin membre
- La vue individuelle reste inchangée

**Vue Team (optionnel, phase 2+) :**
- Dashboard de la team : activité récente, état des membres, mémoire partagée
- Timeline des échanges intra-team

### 2.5 Mémoire et Knowledge partagées

**Mémoire partagée de team :**
- Nouvelle scope de mémoire : en plus des memories `kinId`-scoped, on ajoute des memories `teamId`-scoped
- Tout Kin membre de la team peut lire et écrire dans la mémoire de team
- Le Hub a accès en priorité
- Tool : `team_memorize(content, category)`, `team_recall(query)`

**Knowledge Base partagée :**
- Les knowledge sources peuvent être attachées à une team (pas seulement à un Kin)
- Les chunks sont indexés par `teamId` en plus de `kinId`
- Lors du retrieval, un Kin membre cherche dans sa KB perso + la KB de team

### 2.6 Permissions

- **Créer une team** : admin only (via UI) ou Kin avec opt-in tool
- **Assigner un Kin** : admin only (le Kin ne s'auto-assigne pas)
- **Hub** : désigné par l'admin, un seul par team
- **Mémoire team** : tous les membres lisent/écrivent
- **Knowledge team** : tous les membres lisent, admin gère les sources

---

## 3. Design technique

### 3.1 Schéma DB — Nouvelles tables

```sql
-- Teams
CREATE TABLE teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  icon TEXT,           -- emoji ou Lucide icon
  color TEXT,          -- hex color pour la sidebar
  hub_kin_id TEXT NOT NULL REFERENCES kins(id),
  created_by TEXT REFERENCES user(id),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Team membership (many-to-many)
CREATE TABLE team_members (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kin_id TEXT NOT NULL REFERENCES kins(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'hub' | 'member'
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (team_id, kin_id)
);
CREATE INDEX idx_team_members_kin ON team_members(kin_id);

-- Team-scoped memories
CREATE TABLE team_memories (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  author_kin_id TEXT NOT NULL REFERENCES kins(id),
  content TEXT NOT NULL,
  embedding BLOB,
  category TEXT NOT NULL,  -- same as memories: fact/preference/decision/knowledge
  subject TEXT,
  importance REAL,
  retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_team_memories_team ON team_memories(team_id);
CREATE INDEX idx_team_memories_team_cat ON team_memories(team_id, category);

-- Team-scoped knowledge sources
CREATE TABLE team_knowledge_sources (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  -- same columns as knowledge_sources minus kinId
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  original_filename TEXT,
  mime_type TEXT,
  stored_path TEXT,
  source_url TEXT,
  raw_content TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE team_knowledge_chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES team_knowledge_sources(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding BLOB,
  position INTEGER NOT NULL,
  token_count INTEGER NOT NULL,
  metadata TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_team_kchunks_team ON team_knowledge_chunks(team_id);
```

**Drizzle schema** : ajouter dans `schema.ts` les tables correspondantes avec les mêmes patterns que l'existant.

### 3.2 Backend — Nouveaux services et routes

**Services :**

1. **`src/server/services/teams.ts`** — CRUD teams, gestion membres
   - `createTeam(name, slug, description, hubKinId, createdBy)`
   - `updateTeam(id, updates)`
   - `deleteTeam(id)`
   - `addTeamMember(teamId, kinId)`
   - `removeTeamMember(teamId, kinId)`
   - `getTeam(id)` / `getTeamBySlug(slug)`
   - `getTeamsForKin(kinId)` — retourne les teams dont ce Kin est membre
   - `getTeamMembers(teamId)` — avec détails Kin
   - `isKinInTeam(kinId, teamId)`

2. **`src/server/services/team-memory.ts`** — memories scopées team
   - Même interface que `memory.ts` mais avec `teamId` au lieu de `kinId`
   - `teamMemorize(teamId, authorKinId, content, category, subject)`
   - `getRelevantTeamMemories(teamId, query)` — hybrid search

3. **`src/server/services/team-knowledge.ts`** — knowledge scopée team
   - Même interface que `knowledge.ts` mais avec `teamId`

**Routes :**

- **`src/server/routes/teams.ts`** :
  - `GET /api/teams` — list all teams
  - `POST /api/teams` — create team
  - `GET /api/teams/:id` — get team details + members
  - `PUT /api/teams/:id` — update team
  - `DELETE /api/teams/:id` — delete team
  - `POST /api/teams/:id/members` — add member
  - `DELETE /api/teams/:id/members/:kinId` — remove member
  - `GET /api/teams/:id/memories` — list team memories
  - `GET /api/teams/:id/knowledge` — list team knowledge sources

**Tools (Kin-side) :**

- **`src/server/tools/team-tools.ts`** :
  - `team_memorize` — sauvegarder dans la mémoire de team
  - `team_recall` — chercher dans la mémoire de team
  - `list_team_members` — voir les membres de sa team
  - `get_team_info` — info sur la team courante

**Modifications à l'existant :**

1. **`inter-kin.ts`** :
   - `listAvailableKins()` enrichi avec info team membership
   - Priorité intra-team : rate limits plus souples pour les messages intra-team

2. **`kin-engine.ts`** :
   - Dans `processNextMessage()`, détecter si le Kin est Hub de team → enrichir le prompt
   - Lors du retrieval de memories, ajouter les team memories
   - Lors du retrieval de knowledge, ajouter les team knowledge chunks

3. **`prompt-builder.ts`** :
   - Nouveau paramètre `teamContext` dans `PromptParams`
   - Nouveau block dans le system prompt : "## Team context" avec membres, mémoire, instructions
   - Pour le Hub de team : instructions de routage spécifiques (similaires au Hub global mais scopées)

4. **`app-settings.ts`** :
   - Le Hub global coexiste avec les Hub de teams — pas de changement nécessaire

### 3.3 Frontend — Nouveaux composants

**Sidebar :**

```
sidebar/
├── KinList.tsx          (modifié — affiche les teams comme sections)
├── TeamSection.tsx       (nouveau — groupe de Kins avec header team)
├── TeamCreateDialog.tsx  (nouveau)
├── TeamSettingsDialog.tsx (nouveau)
```

**Concept sidebar :**
- Les Kins non-assignés apparaissent en haut (comme aujourd'hui)
- Chaque team apparaît comme une section collapsible avec icône/couleur
- Le Hub Kin a un badge "Hub" dans sa section team
- Cliquer sur le header de team ouvre le chat du Hub
- Les Kins membres apparaissent indentés sous la team

**Pages / routes :**
- `/team/:slug` → ouvre le chat du Hub de la team (réutilise la page chat existante)
- Pas besoin d'une page "team dashboard" en phase 1

**Settings :**
- Nouvelle section dans les Settings : "Teams" — CRUD teams, drag-and-drop membres

### 3.4 Migration path

1. **Additive only** : nouvelles tables, pas de modification des tables existantes
2. **Le Hub global (`hub_kin_id`) reste** : aucun breaking change
3. **Les Kins sans team fonctionnent exactement comme avant**
4. **Les tools team sont opt-in** (`defaultDisabled: true`) — activés quand un Kin est ajouté à une team
5. **Migration Drizzle** : un seul fichier de migration ajoutant les nouvelles tables

---

## 4. Plan d'implémentation

### Phase 1 — Fondations DB + CRUD (1 cron de 2h)
**Scope :** Schema DB, migration, service CRUD teams, routes API, tests.
- Ajouter les tables `teams`, `team_members` dans le schema Drizzle
- Créer `src/server/services/teams.ts` (CRUD complet)
- Créer `src/server/routes/teams.ts` (API REST)
- Tests unitaires
- **Complexité : Medium**
- **Dépendances : aucune**

### Phase 2 — Frontend sidebar + navigation (1 cron de 2h)
**Scope :** Affichage des teams dans la sidebar, navigation, dialogs create/edit.
- Modifier `KinList.tsx` pour grouper par team
- Créer `TeamSection.tsx`, `TeamCreateDialog.tsx`
- Route `/team/:slug` qui pointe vers le Hub
- Settings page section Teams
- **Complexité : Medium-Large**
- **Dépendances : Phase 1**

### Phase 3 — Hub de Team + prompt enrichi (1 cron de 2h)
**Scope :** Le Hub de team reçoit un prompt enrichi avec les membres et instructions de routage.
- Modifier `kin-engine.ts` : détecter team membership, fetch team data
- Modifier `prompt-builder.ts` : nouveau block "Team context"
- Modifier `inter-kin.ts` : enrichir `listAvailableKins()` avec team info
- Le Hub de team fonctionne comme un coordinateur scopé
- **Complexité : Medium**
- **Dépendances : Phase 1**

### Phase 4 — Mémoire partagée de team (1 cron de 2h)
**Scope :** Team memories avec tools pour les Kins membres.
- Ajouter table `team_memories` au schema
- Créer `src/server/services/team-memory.ts`
- Créer tools `team_memorize`, `team_recall`
- Modifier `kin-engine.ts` : inclure team memories dans le retrieval
- **Complexité : Medium**
- **Dépendances : Phase 1, 3**

### Phase 5 — Knowledge Base partagée (1 cron de 2h)
**Scope :** Knowledge sources scopées team.
- Ajouter tables `team_knowledge_sources`, `team_knowledge_chunks`
- Créer `src/server/services/team-knowledge.ts`
- Modifier le retrieval dans `kin-engine.ts` pour inclure team knowledge
- UI : section knowledge dans les settings de team
- **Complexité : Medium-Large**
- **Dépendances : Phase 1, 4**

### Phase 6 — Polish et intégration (1 cron de 2h)
**Scope :** Rate limits intra-team, tests E2E, edge cases, documentation.
- Rate limits différenciés intra-team vs inter-team
- Tests E2E du flow complet
- Gestion des edge cases (suppression team, suppression Kin membre, etc.)
- Documentation utilisateur
- **Complexité : Medium**
- **Dépendances : toutes les phases précédentes**

---

## 5. Risques et points d'attention

1. **Complexité du prompt** : Le system prompt est déjà long. Ajouter un block team context + team memories + team knowledge augmente significativement le token count. Il faudra être strict sur la taille des injections.

2. **Ambiguïté Hub global vs Hub de team** : Si un Kin est Hub global ET Hub d'une team, les instructions peuvent se chevaucher. Solution : le Hub de team a un scope explicite ("tu es Hub de la team X, voici tes membres"), distinct du Hub global.

3. **Mémoire partagée vs privée** : Un Kin pourrait vouloir mémoriser quelque chose en privé vs en team. Il faut que les tools soient clairs (`memorize` = privé, `team_memorize` = team).

4. **Performance** : Le retrieval de memories/knowledge est déjà un hot path. Ajouter un second pool (team) double le coût. Solution : queries parallèles, limite de résultats combinés.

5. **Multi-team** : Si un Kin est dans 2 teams, il reçoit le contexte des 2 teams dans son prompt. Ça peut devenir lourd. Solution : ne charger le contexte team que quand le message vient d'un membre de cette team (ou du Hub).

---

## 6. Verdict

### Est-ce réaliste ?
**Oui.** L'architecture existante est propre et extensible. Le pattern Hub existe déjà (même s'il est global), l'inter-Kin fonctionne, les memories/knowledge sont bien abstraites. La feature Teams est une extension naturelle, pas une refonte.

### Estimation
**6 crons de 2h = ~12h de travail effectif**, découpés en 6 phases indépendamment livrables.

- Phase 1 (DB + CRUD) : 2h
- Phase 2 (Frontend) : 2h
- Phase 3 (Hub prompt) : 2h
- Phase 4 (Team memory) : 2h
- Phase 5 (Team knowledge) : 2h
- Phase 6 (Polish) : 2h

### Faut-il un cron dédié ?
**Oui, recommandé.** Un cron dédié `kinbot-teams` (2h, Sonnet ou Opus) par phase, exécuté séquentiellement. Chaque phase est autonome et testable. Le cron peut s'appuyer sur ce document comme spec.

### Priorisation recommandée
Phases 1→3 sont le **MVP** : teams visibles, Hub fonctionnel, routage intra-team. Livrable en 3 crons (6h).
Phases 4→6 sont des **enrichissements** : mémoire partagée, knowledge, polish. Livrable en 3 crons supplémentaires.

Le MVP (phases 1-3) apporte déjà 80% de la valeur : l'utilisateur peut créer des teams, voir les groupements dans la sidebar, et parler à un Hub qui connaît ses membres.

---

## Progress Notes

### Phase 1 - DONE (2026-03-08, cron run #1)
- Added `teams` and `team_members` tables to Drizzle schema
- Generated migration `0039_absurd_madame_hydra.sql`
- Created `src/server/services/teams.ts`: full CRUD (create/update/delete teams, add/remove members, queries by ID/slug/kin)
- Created `src/server/routes/teams.ts`: REST API at `/api/teams` (GET list, GET by id, POST create, PATCH update, DELETE, POST members, DELETE members)
- Added 5 SSE event types: `team:created`, `team:updated`, `team:deleted`, `team:member_added`, `team:member_removed`
- Added i18n keys (en + fr) for all team UI strings
- 12 unit tests passing (slug generation, validation, role logic)
- Build passes, all 2360 tests pass
- Commit: `6346e5f` on `feat/teams`
- **Next: Phase 2 (Frontend sidebar + navigation)**

### Phase 2 - DONE (2026-03-08, cron run #2)
- Created `src/client/hooks/useTeams.ts`: fetches teams, listens to SSE events, provides CRUD methods
- Created `src/client/components/team/TeamFormDialog.tsx`: create/edit dialog with name, description, icon picker, color picker, hub kin selector, member checkboxes
- Created `src/client/components/sidebar/TeamSection.tsx`: collapsible team section in sidebar with hub pinned at top
- Modified `src/client/components/sidebar/KinList.tsx`: groups kins by team, ungrouped kins shown separately with drag-and-drop preserved
- Modified `src/client/components/sidebar/AppSidebar.tsx`: passes teams data to KinList
- Created `src/client/pages/settings/TeamsSettings.tsx`: full CRUD settings page with team cards, member badges, create/edit/delete
- Added Teams section to SettingsPage.tsx (under new "Kins" group)
- i18n keys added for both en and fr
- Build passes, all 2413 tests pass
- Commit: `06356f7` on `feat/teams`
- **Next: Phase 3 (Hub Kin prompt enrichment)**

### Phase 3 - DONE (2026-03-08, cron run #3)
- Modified `src/server/services/prompt-builder.ts`: added `TeamContextEntry` interface and `teamContext` to `PromptParams`
- New prompt block `[4.7] Team context` renders differently for Hub vs member Kins:
  - Hub: full routing instructions, member expertise summaries, delegation guidance
  - Member: team awareness, Hub identification, teammate listing
- Modified `src/server/services/kin-engine.ts`: fetches team memberships via `getTeamsForKin()`, builds team context with member expertise, passes to prompt builder
- Modified `src/server/services/inter-kin.ts`:
  - `listAvailableKins()` now enriched with team membership info (teamId, teamName, teamRole)
  - `checkRateLimit()` accepts `isIntraTeam` flag, giving 2x rate limit for intra-team messages
  - `sendInterKinMessage()` detects shared team membership and applies relaxed rate limits
- Added 4 new tests in prompt-builder.test.ts (hub context, member context, empty context, self-exclusion)
- Build passes, all 2438 tests pass
- Commit: `88abc83` on `feat/teams`
- **MVP complete (Phases 1-3)! Next: Phase 4 (Shared team memory)**

### Phase 4 - DONE (2026-03-08, cron run #4)
- Added `team_memories` table to Drizzle schema with embedding, category, subject, importance, retrieval tracking
- Generated migration `0040_little_silverclaw.sql`
- Added FTS5 virtual table (`team_memories_fts`) and sqlite-vec table (`team_memories_vec`) with sync triggers in `db/index.ts`
- Created `src/server/services/team-memory.ts`: full CRUD + hybrid search (semantic + FTS5 with RRF fusion + importance weighting)
- Created `src/server/tools/team-memory-tools.ts`: 5 opt-in tools (`team_recall`, `team_memorize`, `update_team_memory`, `forget_team_memory`, `list_team_memories`) with auto team resolution
- Registered tools in `register.ts` (all `defaultDisabled: true`, enabled when Kin joins a team)
- Modified `kin-engine.ts`: fetches relevant team memories for all teams, passes to prompt builder
- Modified `prompt-builder.ts`: new `relevantTeamMemories` param, renders `[5.1] Team memories` block per team
- Added API routes in `teams.ts`: GET/POST/PATCH/DELETE for `/api/teams/:id/memories` with search support (`?q=...`)
- Added i18n keys (en + fr) for team memories UI strings
- 18 unit tests passing (FTS query building, importance weighting, RRF scoring, input validation, team resolution)
- Build passes, all 2478 tests pass
- Commit: `eb99892` on `feat/teams`
- **Next: Phase 5 (Shared knowledge base)**
