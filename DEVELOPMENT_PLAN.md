# KinBot — Plan de développement

Ce document sert de feuille de route pour le développement de KinBot. Chaque phase est conçue pour être autonome et testable. Les phases doivent être suivies dans l'ordre car chacune dépend des précédentes.

**Convention** : chaque tâche est marquée `[ ]` (à faire), `[~]` (en cours), ou `[x]` (terminé).

---

## Phase 0 — Initialisation du projet

Mise en place du monorepo, de la toolchain, et des fichiers de configuration.

- [x] **0.1** Initialiser le projet avec `bun init`
- [x] **0.2** Configurer `package.json` avec les scripts (`dev`, `build`, `start`, `db:migrate`, `db:push`)
- [x] **0.3** Configurer `tsconfig.json` (strict, paths aliases `@/server/*`, `@/client/*`, `@/shared/*`)
- [x] **0.4** Installer et configurer Vite (`vite.config.ts`) avec proxy API vers le backend en dev
- [x] **0.5** Installer et configurer Tailwind CSS (`tailwind.config.ts`) avec design tokens
- [x] **0.6** Installer et configurer shadcn/ui (`components.json`) — ajouter les composants de base (Button, Input, Card, Dialog, etc.)
- [x] **0.7** Installer et configurer Drizzle (`drizzle.config.ts`) pour SQLite via `bun:sqlite`
- [x] **0.8** Créer l'arborescence de dossiers conforme à `structure.md`
- [x] **0.9** Créer `src/shared/types.ts` et `src/shared/constants.ts` avec les types et constantes partagés
- [x] **0.10** Créer `src/server/config.ts` avec la configuration centralisée (tel que décrit dans `config.md`)
- [x] **0.11** Configurer le Docker (`docker/Dockerfile`, `docker/docker-compose.yml`)
- [x] **0.12** Installer i18next + react-i18next, créer `src/client/locales/en.json` et `fr.json` (squelettes vides)
- [x] **0.13** Créer `src/client/styles/globals.css` avec les design tokens (palette, typographie, spacing) et le dark mode

**Critère de validation** : `bun run dev` démarre le frontend (Vite) et le backend (Hono) sans erreur. La page par défaut s'affiche.

---

## Phase 0.5 — Design system et validation visuelle

> **BLOQUANT** : aucun développement frontend réel (pages, composants métier) ne démarre avant que cette phase soit **validée par le porteur du projet**. Le backend (phases 1-6) peut avancer en parallèle.

Création d'une page showcase présentant tous les éléments visuels de base. L'objectif est de valider la direction graphique (palette, typographie, composants, dark mode) avant de construire les vrais écrans.

- [x] **0.5.1** Créer `src/client/pages/design-system/DesignSystemPage.tsx` — page showcase accessible en dev à `/design-system`, avec les sections suivantes :

  **Palette de couleurs**
  - [x] **0.5.2** Afficher les couleurs primaires, secondaires, accent, success, warning, error, info
  - [x] **0.5.3** Afficher les couleurs de background et surface (light + dark)
  - [x] **0.5.4** Afficher les couleurs de texte (primary, secondary, muted, disabled)

  **Typographie**
  - [x] **0.5.5** Afficher la hiérarchie des titres (h1 → h6) avec la police choisie (Inter ou Plus Jakarta Sans)
  - [x] **0.5.6** Afficher les tailles de texte (body, small, caption, label)
  - [x] **0.5.7** Afficher les poids de police (regular, medium, semibold, bold)

  **Composants de base**
  - [x] **0.5.8** Buttons : toutes les variantes (primary, secondary, outline, ghost, destructive) × tailles (sm, md, lg) + états (default, hover, disabled, loading)
  - [x] **0.5.9** Inputs : text input, textarea, select, avec labels, placeholders, messages d'erreur, états (default, focus, error, disabled)
  - [x] **0.5.10** Cards : card basique, card avec header/footer, card interactive (hover), card avec image
  - [x] **0.5.11** Badges : variantes (default, success, warning, error, info) + tailles
  - [x] **0.5.12** Alerts : success, warning, error, info — avec et sans icône
  - [x] **0.5.13** Checkboxes, Radio buttons, Switch/Toggle
  - [x] **0.5.14** Dialog/Modal : exemple avec formulaire à l'intérieur
  - [x] **0.5.15** Tabs, Dropdown menu, Tooltip
  - [x] **0.5.16** Avatar : différentes tailles, avec image, avec initiales, avec indicateur de statut (online/offline/busy)

  **Patterns spécifiques KinBot**
  - [x] **0.5.17** Bulle de message : variante utilisateur (alignée à droite, couleur A), variante Kin (alignée à gauche, couleur B), variante système/tâche/cron (neutre) — avec avatar, nom, timestamp
  - [x] **0.5.18** Carte de Kin : aperçu d'un Kin dans la sidebar (avatar, nom, rôle, badge queue)
  - [x] **0.5.19** Indicateur de typing / streaming en cours
  - [x] **0.5.20** Indicateur d'état de tâche (pending, in_progress, completed, failed)

  **Spacing et layout**
  - [x] **0.5.21** Afficher l'échelle de spacing (4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px)
  - [x] **0.5.22** Afficher les border-radius utilisés (coins arrondis généreux)
  - [x] **0.5.23** Afficher les ombres (shadows) sur les cards et éléments interactifs

  **Dark mode**
  - [x] **0.5.24** Toggle dark/light sur la page showcase — tous les éléments ci-dessus doivent fonctionner dans les deux thèmes (tons sombres chauds, pas de noir pur)

- [x] **0.5.25** Route `/design-system` accessible uniquement en mode développement (pas en production)

**Critère de validation** : le porteur du projet ouvre `/design-system`, passe en revue chaque section en light et dark mode, et **approuve** la direction visuelle. Les ajustements demandés sont appliqués avant de continuer.

> **Une fois validé** : les phases frontend (3, 7, 8, 9.6-9.10, etc.) peuvent démarrer en s'appuyant sur les composants et tokens approuvés. La page `/design-system` reste disponible en dev comme référence.

---

## Phase 1 — Base de données et schéma

Définition complète du schéma Drizzle et création de la base SQLite.

- [x] **1.1** Créer `src/server/db/index.ts` — connexion SQLite via `bun:sqlite` avec chargement des extensions (sqlite-vec, FTS5)
- [x] **1.2** Créer `src/server/db/schema.ts` — définir **toutes** les tables Drizzle conformes à `schema.md` :
  - Tables Better Auth : `user`, `session`, `account`, `verification`
  - Tables custom : `user_profiles`, `providers`, `kins`, `mcp_servers`, `kin_mcp_servers`, `messages`, `compacting_snapshots`, `memories`, `contacts`, `custom_tools`, `tasks`, `crons`, `vault_secrets`, `queue_items`, `files`
- [x] **1.3** Créer les index conformes au schéma (tous les `idx_*` documentés)
- [x] **1.4** Créer les tables virtuelles FTS5 (`memories_fts`, `messages_fts`) avec triggers de synchronisation
- [x] **1.5** Créer la table virtuelle sqlite-vec (`memories_vec`)
- [x] **1.6** Générer et exécuter la première migration Drizzle
- [ ] **1.7** (Optionnel) Créer `src/server/db/seed.ts` pour le développement

**Critère de validation** : `bun run db:push` crée la base avec toutes les tables. Vérifiable via `sqlite3 data/kinbot.db ".tables"`.

---

## Phase 2 — Authentification et gestion des utilisateurs

- [x] **2.1** Installer Better Auth et configurer `src/server/auth/index.ts` (adapter pour SQLite + Drizzle)
- [x] **2.2** Créer `src/server/auth/middleware.ts` — middleware Hono vérifiant la session (cookie HTTP-only) sur `/api/*` sauf `/api/auth/*` et `/api/onboarding/*`
- [x] **2.3** Créer `src/server/app.ts` — configuration Hono (CORS, middleware auth, montage des routes)
- [x] **2.4** Créer `src/server/index.ts` — point d'entrée (Hono app + serve static en prod)
- [x] **2.5** Créer les routes auth :
  - `src/server/routes/auth.ts` — `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- [x] **2.6** Créer les routes profil :
  - `src/server/routes/me.ts` — `GET /api/me`, `PATCH /api/me`, `POST /api/me/avatar`
- [x] **2.7** Créer la route onboarding :
  - `src/server/routes/onboarding.ts` — `GET /api/onboarding/status`
- [x] **2.8** Frontend : créer `src/client/lib/api.ts` — client API (fetch wrapper avec credentials: 'include')
- [x] **2.9** Frontend : créer le hook `src/client/hooks/useAuth.ts`
- [x] **2.10** Frontend : créer `src/client/pages/login/LoginPage.tsx`
- [x] **2.11** Frontend : créer `src/client/App.tsx` — router avec redirection vers login ou onboarding si nécessaire

**Critère de validation** : un utilisateur peut s'inscrire, se connecter, se déconnecter. Le middleware bloque les requêtes non authentifiées. La page de login fonctionne.

---

## Phase 3 — Onboarding

- [x] **3.1** Frontend : créer `src/client/pages/onboarding/OnboardingPage.tsx` — wizard avec navigation entre étapes
- [x] **3.2** Frontend : créer `src/client/pages/onboarding/StepIdentity.tsx` — formulaire (photo, prénom, nom, email, pseudonyme, langue, mot de passe)
- [x] **3.3** Frontend : créer `src/client/pages/onboarding/StepProviders.tsx` — configuration des AI providers avec test de connexion en temps réel
- [x] **3.3b** Frontend : créer `src/client/pages/onboarding/StepSearchProviders.tsx` — configuration des search providers (step optionnel, même UX que StepProviders)
- [x] **3.4** Backend : logique de validation de l'onboarding (vérifier que les capacités `llm` et `embedding` sont couvertes)
- [x] **3.5** Backend : créer le premier `user_profiles` avec rôle `admin` à l'issue de l'onboarding
- [x] **3.6** Après onboarding réussi, redirection vers l'interface principale avec ouverture automatique de la modale de création du premier Kin

**Critère de validation** : un utilisateur neuf arrive sur le wizard, configure son profil et au moins un provider, et atterrit sur l'interface principale.

---

## Phase 4 — Providers IA

Gestion des providers et abstraction des capacités.

- [x] **4.1** Créer `src/server/providers/types.ts` — interfaces `ProviderConfig`, `LLMCapability`, `EmbeddingCapability`, `ImageCapability`
- [x] **4.2** Créer `src/server/providers/index.ts` — registry des providers, résolution par capacité
- [x] **4.3** Implémenter `src/server/providers/anthropic.ts` (LLM via Vercel AI SDK)
- [x] **4.4** Implémenter `src/server/providers/openai.ts` (LLM + Embedding + Image via Vercel AI SDK)
- [x] **4.5** Implémenter `src/server/providers/gemini.ts` (LLM + Image via Vercel AI SDK)
- [x] **4.6** Implémenter `src/server/providers/voyage.ts` (Embedding via Vercel AI SDK)
- [x] **4.6b** Implémenter `src/server/providers/brave-search.ts` (Search — Brave Web Search API)
- [x] **4.7** Créer `src/server/services/embeddings.ts` — service d'embedding (résolution du provider, génération de vecteurs)
- [x] **4.7b** Créer `src/server/services/search.ts` — service de recherche web (résolution du provider search, exécution des requêtes)
- [x] **4.8** Créer les routes :
  - `src/server/routes/providers.ts` — `GET /api/providers`, `POST /api/providers`, `PATCH /api/providers/:id`, `DELETE /api/providers/:id`, `POST /api/providers/:id/test`, `GET /api/providers/models`
- [x] **4.9** Implémenter le chiffrement des configs provider (`config_encrypted`) avec la clé `ENCRYPTION_KEY`

**Critère de validation** : on peut créer un provider (ex: OpenAI), tester la connexion, et lister les modèles disponibles via l'API.

---

## Phase 5 — Event bus et hooks

Infrastructure transversale utilisée par toutes les couches suivantes.

- [x] **5.1** Créer `src/server/services/events.ts` — event bus in-memory (`emit`, `on`, `off`)
- [x] **5.2** Créer `src/server/hooks/types.ts` — types des hooks (`HookContext`, `HookHandler`)
- [x] **5.3** Créer `src/server/hooks/index.ts` — registry des hooks + exécution chainée (`beforeChat`, `afterChat`, `beforeToolCall`, `afterToolCall`, `beforeCompacting`, `afterCompacting`, `onTaskSpawn`, `onCronTrigger`)

**Critère de validation** : on peut émettre un événement et le recevoir dans un listener. Les hooks peuvent être enregistrés et exécutés.

---

## Phase 6 — SSE (Server-Sent Events)

Communication temps réel du serveur vers le client.

- [x] **6.1** Créer `src/server/sse/types.ts` — types des événements SSE (`chat:token`, `chat:done`, `chat:message`, `task:status`, `task:done`, `cron:triggered`, `queue:update`, `kin:error`)
- [x] **6.2** Créer `src/server/sse/index.ts` — gestionnaire SSE (gestion des connexions, broadcast par kinId, cleanup)
- [x] **6.3** Créer `src/server/routes/sse.ts` — `GET /api/sse` (connexion SSE globale, une par client)
- [x] **6.4** Frontend : créer `src/client/hooks/useSSE.ts` — connexion SSE persistante, dispatch des événements par kinId, reconnexion automatique

**Critère de validation** : le frontend se connecte en SSE et reçoit un événement de test envoyé depuis le backend.

---

## Phase 7 — CRUD Kins (sans moteur LLM)

Gestion des Kins : création, édition, suppression, avatar.

- [x] **7.1** Créer les routes :
  - `src/server/routes/kins.ts` — `GET /api/kins`, `GET /api/kins/:id`, `POST /api/kins`, `PATCH /api/kins/:id`, `DELETE /api/kins/:id`, `POST /api/kins/:id/avatar`
- [x] **7.2** Logique de création du workspace du Kin (`{dataDir}/workspaces/{kinId}/`)
- [x] **7.3** Gestion des avatars (upload, génération automatique si provider image disponible, prompt personnalisé)
- [x] **7.4** Frontend : créer le hook `src/client/hooks/useKins.ts`
- [x] **7.5** Frontend : créer `src/client/components/kin/KinCreateModal.tsx`
- [x] **7.6** Frontend : créer `src/client/components/kin/KinCard.tsx`
- [x] **7.7** Frontend : créer `src/client/components/kin/KinSettingsModal.tsx`

**Critère de validation** : on peut créer, modifier et supprimer un Kin via l'interface. Le workspace est créé sur le disque.

---

## Phase 8 — Interface principale (layout)

Layout global de l'application : sidebar + panel de chat.

- [x] **8.1** Frontend : créer `src/client/components/sidebar/AppSidebar.tsx` — layout avec sections Kins, Tâches, liens vers Mon compte et Settings
- [x] **8.2** Frontend : créer `src/client/components/sidebar/KinList.tsx` — liste des Kins avec badges (queue, statut)
- [x] **8.3** Frontend : créer `src/client/components/sidebar/TaskList.tsx` — liste des tâches en cours
- [x] **8.4** Frontend : créer `src/client/pages/chat/ChatPage.tsx` — layout sidebar + panel principal
- [x] **8.5** Utilisation des composants Avatar et Badge existants de shadcn/ui
- [x] **8.6** Frontend : créer les pages settings :
  - `src/client/pages/settings/SettingsPage.tsx`
  - `src/client/pages/settings/ProvidersSettings.tsx` (AI providers)
  - [x] `src/client/pages/settings/SearchProvidersSettings.tsx` (search providers — même pattern que ProvidersSettings, composants partagés)
  - McpSettings et VaultSettings en stub dans les tabs
- [x] **8.7** Frontend : créer `src/client/pages/account/AccountPage.tsx`

**Critère de validation** : le layout complet est visible. On peut naviguer entre les Kins dans la sidebar et accéder aux pages settings/compte.

---

## Phase 9 — Queue FIFO et moteur Kin (coeur du système)

Orchestration LLM, queue de messages, construction du prompt, streaming.

- [x] **9.1** Créer `src/server/services/queue.ts` — queue FIFO par Kin (enqueue, dequeue, priorité user > auto, poll)
- [x] **9.2** Créer `src/server/services/prompt-builder.ts` — construction du prompt système conforme à `prompt-system.md` (blocs 1-8)
- [x] **9.3** Créer `src/server/services/kin-engine.ts` — orchestration LLM :
  - Récupération du message de la queue
  - Construction du contexte (prompt système + compacting summary + messages récents)
  - Appel LLM via Vercel AI SDK avec streaming
  - Émission SSE des tokens (`chat:token`) et fin (`chat:done`)
  - Sauvegarde du message assistant en DB
  - Émission d'événements sur l'event bus
  - Exécution des hooks `beforeChat` / `afterChat`
- [x] **9.4** Créer la route messages :
  - `src/server/routes/messages.ts` — `POST /api/kins/:id/messages` (enqueue + réponse 202), `GET /api/kins/:id/messages` (historique paginé)
- [x] **9.5** Intégrer le worker de queue : boucle de traitement qui poll les queues de tous les Kins actifs
- [x] **9.6** Frontend : créer `src/client/hooks/useChat.ts` — gestion du streaming SSE, optimistic updates
- [x] **9.7** Frontend : créer `src/client/components/chat/ChatPanel.tsx` — affichage des messages + streaming
- [x] **9.8** Frontend : créer `src/client/components/chat/MessageBubble.tsx` — bulle de message avec distinction visuelle par source (user, kin, task, cron)
- [x] **9.9** Frontend : créer `src/client/components/chat/MessageInput.tsx` — input avec envoi de message
- [x] **9.10** Frontend : créer `src/client/components/chat/TypingIndicator.tsx`
- [x] **9.11** Émettre `queue:update` en SSE à chaque changement de la queue (taille, isProcessing)

**Critère de validation** : on peut envoyer un message à un Kin et recevoir une réponse streamée en temps réel. Le message est sauvegardé en DB et visible dans l'historique.

---

## Phase 10 — Outils natifs de base (Tool calling)

Intégration du tool calling Vercel AI SDK et outils fondamentaux.

- [x] **10.1** Créer `src/server/tools/types.ts` — types `ToolDefinition`, `ToolResult`
- [x] **10.2** Créer `src/server/tools/index.ts` — registry de tous les outils, résolution par contexte (main agent vs sub-Kin)
- [x] **10.3** Intégrer le tool calling dans `kin-engine.ts` — passage des tools au LLM, exécution des appels, boucle outil-réponse
- [x] **10.4** Implémenter les hooks `beforeToolCall` / `afterToolCall`
- [x] **10.5** Créer `src/server/tools/search-tools.ts` — `web_search(query, count?, freshness?)` (via search provider, conditionné à la présence d'un provider avec capacité `search`)

**Critère de validation** : le Kin peut appeler un outil natif et utiliser le résultat dans sa réponse. Si un search provider est configuré, le Kin peut rechercher sur le web.

---

## Phase 11 — Contacts

Registre de contacts par Kin.

- [x] **11.1** Créer `src/server/services/contacts.ts` — CRUD contacts, injection du résumé compact dans le prompt
- [x] **11.2** Créer `src/server/tools/contact-tools.ts` — `get_contact`, `search_contacts`, `create_contact`, `update_contact`
- [x] **11.3** Intégrer l'injection du bloc [4] (contacts) dans `prompt-builder.ts`

**Critère de validation** : le Kin peut créer et consulter des contacts via ses outils. Le résumé compact apparaît dans le prompt système.

---

## Phase 12 — Mémoire long terme

Pipeline d'extraction, recall, memorize, recherche hybride.

- [x] **12.1** Créer `src/server/services/memory.ts` — CRUD mémoires, génération d'embeddings, recherche hybride (sqlite-vec KNN + FTS5 rank fusion)
- [x] **12.2** Créer `src/server/tools/memory-tools.ts` — `recall`, `memorize`, `update_memory`, `forget`, `list_memories`
- [x] **12.3** Intégrer l'injection du bloc [5] (mémoires pertinentes) dans `prompt-builder.ts` — recherche sémantique à partir du message entrant
- [x] **12.4** Créer `src/server/tools/history-tools.ts` — `search_history` (recherche hybride sur les messages)

**Critère de validation** : le Kin peut mémoriser et rappeler des informations. La recherche hybride retourne des résultats pertinents. Les mémoires sont injectées dans le prompt.

---

## Phase 13 — Compacting

Résumé automatique des sessions et extraction de mémoires.

- [x] **13.1** Créer `src/server/services/compacting.ts` conforme à `compacting.md` :
  - Évaluation du seuil (messages + tokens)
  - Sélection des messages à compacter (exclusion `redact_pending`)
  - Appel LLM pour générer le résumé
  - Sauvegarde du snapshot (activer/désactiver)
  - Nettoyage des anciens snapshots
  - Déclenchement du pipeline d'extraction de mémoires
- [x] **13.2** Intégrer l'injection du bloc [9] (compacted summary) dans la construction des messages du contexte
- [x] **13.3** Déclencher le compacting après chaque tour LLM dans `kin-engine.ts`
- [x] **13.4** Créer les routes compacting :
  - Routes dans `src/server/routes/kins.ts` : `POST /api/kins/:id/compacting/purge`, `GET /api/kins/:id/compacting/snapshots`, `POST /api/kins/:id/compacting/rollback`
- [x] **13.5** Créer les routes memories (gestion via UI) :
  - `GET /api/kins/:id/memories`, `DELETE /api/kins/:id/memories/:memoryId`

**Critère de validation** : après ~50 messages, le compacting se déclenche automatiquement. Le résumé apparaît en contexte. Les mémoires sont extraites. La purge et le rollback fonctionnent.

---

## Phase 14 — Vault (secrets)

Gestion des secrets chiffrés et caviardage.

- [x] **14.1** Créer `src/server/services/vault.ts` — CRUD secrets, chiffrement/déchiffrement AES-256-GCM, `redact_message`
- [x] **14.2** Créer `src/server/tools/vault-tools.ts` — `get_secret`, `redact_message`
- [x] **14.3** Créer les routes :
  - `src/server/routes/vault.ts` — `GET /api/vault`, `POST /api/vault`, `PATCH /api/vault/:id`, `DELETE /api/vault/:id`
- [x] **14.4** Implémenter la priorité du caviardage sur le compacting (bloquer le compacting si `redact_pending = 1`)

**Critère de validation** : on peut créer un secret, le Kin peut le lire via `get_secret`, et le caviardage fonctionne (le message est masqué et bloque le compacting).

---

## Phase 15 — Tâches (sous-Kins)

Spawning, cycle de vie, request_input, résolution.

- [x] **15.1** Créer `src/server/services/tasks.ts` — cycle de vie complet :
  - Spawn (clone de soi-même ou d'un autre Kin)
  - Modes `await` et `async`
  - Gestion de la profondeur (`depth`, max configurable)
  - Résolution : `completed`, `failed`, `cancelled`
  - Restitution dans la session parente (via queue pour `await`, informatif pour `async`)
- [x] **15.2** Créer `src/server/tools/task-tools.ts` — outils parent : `spawn_self`, `spawn_kin`, `respond_to_task`, `cancel_task`, `list_tasks`
- [x] **15.3** Créer `src/server/tools/subtask-tools.ts` — outils sous-Kin : `report_to_parent`, `update_task_status`, `request_input` (max 3 appels)
- [x] **15.4** Adapter `kin-engine.ts` pour exécuter un sous-Kin (prompt adapté, outils limités, contexte de tâche)
- [x] **15.5** Créer les routes :
  - `src/server/routes/tasks.ts` — `GET /api/tasks`, `GET /api/tasks/:id`, `POST /api/tasks/:id/cancel`
- [x] **15.6** Émettre les événements SSE : `task:status`, `task:done`
- [ ] **15.7** Frontend : mettre à jour `TaskList.tsx` dans la sidebar avec les tâches en cours et leur statut

**Critère de validation** : un Kin peut spawner un sous-Kin, le sous-Kin exécute sa tâche, le résultat revient dans la session parente. Le mode `await` et `async` fonctionnent. `request_input` est limité à 3.

---

## Phase 16 — Communication inter-Kins

Messagerie directe entre Kins avec garde-fous.

- [x] **16.1** Créer `src/server/services/inter-kin.ts` — `send_message`, `reply`, corrélation request_id, rate limiting, compteur de profondeur
- [x] **16.2** Créer `src/server/tools/inter-kin-tools.ts` — `send_message`, `reply`, `list_kins`
- [x] **16.3** Intégrer les messages inter-Kins dans la queue FIFO (type `kin_request`, `kin_inform`, `kin_reply`)
- [x] **16.4** Garantir que les `reply` sont toujours de type `inform` (pas de ping-pong)

**Critère de validation** : un Kin peut envoyer un `request` à un autre Kin, celui-ci répond via `reply`, et la réponse est corrélée au request original. Le rate limiting bloque les abus.

---

## Phase 17 — Crons (tâches planifiées)

Scheduler in-process avec croner.

- [x] **17.1** Créer `src/server/services/crons.ts` — scheduler croner, spawn de sous-Kin à chaque déclenchement, respect des limites (`maxActive`, `maxConcurrentExecutions`)
- [x] **17.2** Créer `src/server/tools/cron-tools.ts` — `create_cron`, `update_cron`, `delete_cron`, `list_crons`
- [x] **17.3** Créer les routes :
  - `src/server/routes/crons.ts` — `GET /api/crons`, `POST /api/crons`, `PATCH /api/crons/:id`, `DELETE /api/crons/:id`, `POST /api/crons/:id/approve`
- [x] **17.4** Logique d'approbation : un cron créé par un Kin nécessite une validation utilisateur (`requires_approval`)
- [x] **17.5** Restitution du résultat : déposé dans la session comme message informatif (pas de tour LLM)
- [x] **17.6** Émettre l'événement SSE `cron:triggered`

**Critère de validation** : un cron s'exécute à l'heure prévue, spawn un sous-Kin, et le résultat apparaît dans le chat. Un cron créé par un Kin attend l'approbation.

---

## Phase 18 — MCP Servers

Gestion des serveurs MCP et exposition des outils aux Kins.

- [x] **18.1** Créer les routes :
  - `src/server/routes/mcp-servers.ts` — `GET /api/mcp-servers`, `POST /api/mcp-servers`, `DELETE /api/mcp-servers/:id`
- [x] **18.2** Implémenter le lancement des processus MCP, la découverte des outils exposés, et leur injection dans le tool calling du Kin
- [x] **18.3** Gérer la liaison Kin ↔ MCP servers (table `kin_mcp_servers`)

**Critère de validation** : on peut configurer un serveur MCP, l'assigner à un Kin, et le Kin peut utiliser les outils exposés par le serveur.

---

## Phase 19 — Outils custom (auto-générés)

Permettre aux Kins de créer et gérer leurs propres outils.

- [x] **19.1** Créer `src/server/tools/custom-tool-tools.ts` — `register_tool`, `run_custom_tool`, `list_custom_tools`
- [x] **19.2** Implémenter l'exécution confinée au workspace du Kin (validation du path)
- [x] **19.3** Injecter les outils custom dans les tool definitions du Kin

**Critère de validation** : un Kin peut créer un script dans son workspace, l'enregistrer comme outil, et l'exécuter via `run_custom_tool`.

---

## Phase 20 — Upload de fichiers

- [x] **20.1** Créer `src/server/services/files.ts` — upload, stockage local, référencement en DB
- [x] **20.2** Créer les routes :
  - `src/server/routes/files.ts` — `POST /api/files/upload`
- [x] **20.3** Intégrer les fichiers dans les messages (référencement dans la table `files`, inclusion dans le contexte LLM)
- [ ] **20.4** Frontend : intégrer l'upload dans `MessageInput.tsx` (drag & drop, bouton d'ajout)

**Critère de validation** : un utilisateur peut envoyer un fichier avec son message. Le fichier est stocké et visible dans l'historique.

---

## Phase 21 — Génération d'images

- [x] **21.1** Créer `src/server/tools/image-tools.ts` — `generate_image` (via provider image)
- [x] **21.2** Conditionner la disponibilité de l'outil à la présence d'un provider avec capacité `image`

**Critère de validation** : si un provider image est configuré, le Kin peut générer des images. Sinon, l'outil n'est pas disponible.

---

## Phase 22 — Internationalisation

- [x] **22.1** Compléter `src/client/locales/en.json` et `fr.json` avec toutes les clés de l'interface
- [x] **22.2** Configurer `src/client/lib/i18n.ts` — détection de la langue à partir de `user_profiles.language`
- [x] **22.3** Remplacer tous les textes en dur dans les composants React par des appels `t('key')`

**Critère de validation** : l'interface affiche correctement en français et en anglais selon la préférence utilisateur. Le changement de langue est immédiat.

---

## Phase 23 — Dark mode

- [x] **23.1** Implémenter le thème sombre dans `globals.css` (custom properties CSS)
- [x] **23.2** S'assurer que tous les composants shadcn/ui et custom respectent les variables de thème
- [x] **23.3** Ajouter un toggle dark mode (ou suivre la préférence système)

**Critère de validation** : le dark mode fonctionne sur toute l'interface avec des tons sombres chauds.

---

## Phase 24 — Polissage et tests

- [x] **24.1** Gestion des erreurs LLM : retry sur rate limit, messages d'erreur dans le chat, warning dans la sidebar
- [x] **24.2** Limites de concurrence : vérifier `tasks.maxConcurrent` et `crons.maxConcurrentExecutions`
- [x] **24.3** Vérifier que la suppression d'un provider bloquée si c'est le dernier couvrant une capacité requise (`PROVIDER_REQUIRED`)
- [x] **24.4** Vérifier les garde-fous inter-Kins (rate limiting, profondeur max)
- [x] **24.5** Vérifier que la profondeur de spawning est respectée
- [x] **24.6** Responsive : s'assurer que la sidebar est utilisable sur tablette
- [x] **24.7** Performance : vérifier que le compacting et les embeddings ne bloquent pas le thread principal
- [x] **24.8** Sécurité : auditer les routes (injection SQL via Drizzle, XSS dans les messages, path traversal dans les workspaces)

**Critère de validation** : l'application est stable, les cas limites sont gérés, les performances sont acceptables.

---

## Phase 25 — Docker et déploiement

- [x] **25.1** Finaliser le `Dockerfile` (build multi-stage : Vite build + Bun runtime)
- [x] **25.2** Finaliser le `docker-compose.yml` (volume pour `data/`, env vars)
- [x] **25.3** Tester le déploiement complet via `docker run`
- [x] **25.4** Vérifier que les extensions SQLite (sqlite-vec, FTS5) fonctionnent dans le conteneur
- [x] **25.5** Générer automatiquement `ENCRYPTION_KEY` si absente au premier lancement

**Critère de validation** : `docker run -v ./data:/app/data -p 3000:3000 kinbot` lance l'application complète, fonctionnelle et persistante.

---

## Résumé des dépendances entre phases

```
Phase 0 (Init)
  ├── Phase 0.5 (Design system) ← VALIDATION VISUELLE REQUISE
  │     │                          Le backend peut avancer en parallèle,
  │     │                          mais le frontend réel est bloqué.
  │     │
  └── Phase 1 (DB)
        └── Phase 2 (Auth)
              ├── Phase 3 (Onboarding) ← nécessite Phase 0.5 validée
              └── Phase 4 (Providers)
                    └── Phase 5 (Event bus)
                    └── Phase 6 (SSE)
                          └── Phase 7 (CRUD Kins) ← nécessite Phase 0.5 validée
                                └── Phase 8 (Layout) ← nécessite Phase 0.5 validée
                                └── Phase 9 (Queue + Engine) ← COEUR
                                      └── Phase 10 (Tool calling)
                                            ├── Phase 11 (Contacts)
                                            ├── Phase 12 (Mémoire)
                                            │     └── Phase 13 (Compacting)
                                            ├── Phase 14 (Vault)
                                            ├── Phase 15 (Tâches)
                                            │     └── Phase 16 (Inter-Kins)
                                            │     └── Phase 17 (Crons)
                                            ├── Phase 18 (MCP)
                                            ├── Phase 19 (Custom tools)
                                            ├── Phase 20 (Files)
                                            ├── Phase 21 (Images)
                                            └── (Search tools — Phase 10.5, requires Phase 4.6b)
Phase 22 (i18n) — peut commencer dès Phase 8
Phase 23 (Dark mode) — déjà couvert par Phase 0.5 (tokens + toggle), compléter si besoin
Phase 24 (Polish) — après toutes les phases fonctionnelles
Phase 25 (Docker) — en parallèle dès Phase 9
```

---

## Notes pour l'agent développeur

1. **Lire la documentation** : avant de commencer chaque phase, relire le fichier de spec correspondant (`idea.md`, `schema.md`, `api.md`, `config.md`, `structure.md`, `prompt-system.md`, `compacting.md`)
2. **Conventions** : respecter strictement les conventions de nommage et d'imports décrites dans `structure.md`
3. **Tests manuels** : à la fin de chaque phase, valider le critère de validation avant de passer à la suivante
4. **Commits** : un commit par sous-tâche terminée, avec un message clair
5. **Ne pas anticiper** : ne pas implémenter de fonctionnalités des phases futures. Chaque phase doit être minimale et suffisante
6. **Erreurs** : suivre le format standard `{ "error": { "code": "...", "message": "..." } }` pour toutes les routes API
7. **Types partagés** : tout type utilisé à la fois côté client et serveur doit être dans `src/shared/types.ts`
