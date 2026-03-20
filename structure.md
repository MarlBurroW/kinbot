# KinBot — Structure du projet

Monorepo avec frontend et backend dans le même dépôt, servis par un seul process Bun.

---

## Arborescence

```
kinbot/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
│
├── src/
│   ├── server/                     # Backend (Bun + Hono)
│   │   ├── index.ts                # Point d'entrée : Hono app + serve static
│   │   ├── app.ts                  # Configuration Hono (middleware, routes)
│   │   │
│   │   ├── routes/                 # Routes API REST
│   │   │   ├── auth.ts             # POST /api/auth/*
│   │   │   ├── me.ts               # GET/PATCH /api/me
│   │   │   ├── kins.ts             # CRUD /api/kins
│   │   │   ├── messages.ts         # POST /api/kins/:id/messages
│   │   │   ├── providers.ts        # CRUD /api/providers
│   │   │   ├── tasks.ts            # GET /api/tasks
│   │   │   ├── crons.ts            # CRUD /api/crons
│   │   │   ├── mcp-servers.ts      # CRUD /api/mcp-servers
│   │   │   ├── vault.ts            # CRUD /api/vault
│   │   │   ├── webhooks.ts         # CRUD /api/webhooks + filter testing
│   │   │   ├── webhooks-incoming.ts # POST /api/webhooks/incoming/:id
│   │   │   ├── channel-telegram.ts # Telegram webhook endpoint
│   │   │   ├── files.ts            # POST /api/files/upload
│   │   │   └── sse.ts              # GET /api/sse (connexion SSE globale)
│   │   │
│   │   ├── services/               # Logique métier
│   │   │   ├── kin-engine.ts       # Orchestration LLM : construction du contexte, appels, streaming
│   │   │   ├── prompt-builder.ts   # Construction du prompt système d'un Kin
│   │   │   ├── queue.ts            # Queue FIFO par Kin (enqueue, dequeue, priorité)
│   │   │   ├── compacting.ts       # Compacting des sessions (résumé, snapshots, rollback)
│   │   │   ├── memory.ts           # Mémoire long terme (extraction, recall, memorize, search hybride)
│   │   │   ├── embeddings.ts       # Génération d'embeddings via provider
│   │   │   ├── contacts.ts         # CRUD contacts + injection résumé compact
│   │   │   ├── tasks.ts            # Cycle de vie des tâches (spawn, status, résolution, concurrence)
│   │   │   ├── crons.ts            # Scheduler (croner) + spawn des sous-Kins
│   │   │   ├── inter-kin.ts        # Communication inter-Kins (send_message, reply, garde-fous)
│   │   │   ├── vault.ts            # Gestion des secrets (chiffrement, get_secret, redact)
│   │   │   ├── webhooks.ts         # Gestion des webhooks (CRUD, filtrage payload, logs)
│   │   │   ├── channels.ts         # Gestion des canaux de messagerie (enqueue, delivery)
│   │   │   ├── files.ts            # Upload, stockage, référencement des fichiers
│   │   │   ├── field-validator.ts  # Validation des champs Kin (nom, rôle, modèle, provider)
│   │   │   └── events.ts           # Event bus (emit, on, listeners)
│   │   │
│   │   ├── channels/               # Adaptateurs de canaux de messagerie
│   │   │   ├── adapter.ts          # Interface commune ChannelAdapter
│   │   │   ├── telegram.ts         # Adaptateur Telegram (webhook + long polling)
│   │   │   ├── telegram-utils.ts   # Utilitaires Telegram partagés (attachments, file types)
│   │   │   ├── discord.ts          # Adaptateur Discord (Gateway WebSocket)
│   │   │   ├── slack.ts            # Adaptateur Slack (Events API)
│   │   │   ├── whatsapp.ts         # Adaptateur WhatsApp (Cloud API)
│   │   │   ├── signal.ts           # Adaptateur Signal (signal-cli REST)
│   │   │   └── matrix.ts           # Adaptateur Matrix (long-poll sync)
│   │   │
│   │   ├── providers/              # Implémentations des providers IA
│   │   │   ├── index.ts            # Registry des providers + résolution par capacité
│   │   │   ├── types.ts            # Interfaces (ProviderConfig, LLMCapability, etc.)
│   │   │   ├── anthropic.ts        # Implémentation Anthropic
│   │   │   ├── openai.ts           # Implémentation OpenAI
│   │   │   ├── gemini.ts           # Implémentation Gemini
│   │   │   └── voyage.ts           # Implémentation Voyage AI
│   │   │
│   │   ├── tools/                  # Outils natifs exposés aux Kins
│   │   │   ├── index.ts            # Registry de tous les outils + résolution par contexte
│   │   │   ├── register.ts         # Enregistrement de tous les outils natifs
│   │   │   ├── types.ts            # Types communs (ToolDefinition, ToolResult)
│   │   │   ├── memory-tools.ts     # recall, memorize, update_memory, forget, list_memories
│   │   │   ├── contact-tools.ts    # get_contact, search_contacts, create_contact, update_contact
│   │   │   ├── history-tools.ts    # search_history
│   │   │   ├── inter-kin-tools.ts  # send_message, reply, list_kins
│   │   │   ├── task-tools.ts       # spawn_self, spawn_kin, respond_to_task, cancel_task, list_tasks, list_active_queues
│   │   │   ├── subtask-tools.ts    # report_to_parent, update_task_status, request_input
│   │   │   ├── cron-tools.ts       # create_cron, update_cron, delete_cron, list_crons
│   │   │   ├── webhook-tools.ts    # create_webhook, update_webhook, delete_webhook, list_webhooks
│   │   │   ├── vault-tools.ts      # get_secret, redact_message
│   │   │   ├── filesystem-tools.ts # read_file, write_file, edit_file, list_directory
│   │   │   ├── grep-tools.ts       # grep — regex search across files (rg/grep fallback)
│   │   │   ├── multi-edit-tools.ts # multi_edit — atomic multi-replacement in a single file
│   │   │   ├── shell-tools.ts      # run_shell
│   │   │   ├── custom-tool-tools.ts # register_tool, run_custom_tool, list_custom_tools
│   │   │   └── image-tools.ts      # generate_image
│   │   │
│   │   ├── db/                     # Base de données
│   │   │   ├── index.ts            # Connexion SQLite (bun:sqlite) + extensions (sqlite-vec, FTS5)
│   │   │   ├── schema.ts           # Schéma Drizzle (toutes les tables)
│   │   │   ├── migrations/         # Migrations Drizzle
│   │   │   └── seed.ts             # Seed de développement (optionnel)
│   │   │
│   │   ├── auth/                   # Authentification
│   │   │   ├── index.ts            # Configuration Better Auth
│   │   │   └── middleware.ts       # Middleware d'authentification Hono
│   │   │
│   │   ├── sse/                    # Server-Sent Events
│   │   │   ├── index.ts            # SSE manager (connexions, broadcast)
│   │   │   └── types.ts            # Types des événements SSE
│   │   │
│   │   ├── hooks/                  # Hook system
│   │   │   └── index.ts            # Hook registry and dispatch
│   │   │
│   │   ├── logger.ts               # Logger (pino)
│   │   └── config.ts               # Configuration centralisée
│   │
│   ├── client/                     # Frontend (React + Vite)
│   │   ├── main.tsx                # Point d'entrée React
│   │   ├── App.tsx                 # Router principal
│   │   ├── components/             # Composants React
│   │   ├── hooks/                  # Hooks React custom
│   │   ├── lib/                    # Utilitaires client
│   │   └── locales/                # Traductions i18n (fr, en, de, es)
│   │
│   ├── shared/                     # Code partagé client/serveur
│   │   ├── types.ts                # Types TypeScript partagés
│   │   └── constants.ts            # Constantes partagées
│   │
│   └── test-helpers.ts             # Helpers et mocks pour les tests
│
├── docs-site/                      # Documentation publique (Astro + Starlight)
│   ├── astro.config.mjs
│   └── src/content/docs/           # Pages de documentation Markdown
│
├── store/                          # Plugins intégrés
│   ├── home-automation/            # Plugin Home Assistant
│   └── rss-reader/                 # Plugin RSS reader
│
└── data/                           # Données persistantes (gitignored)
    ├── kinbot.db                   # Base SQLite
    ├── uploads/                    # Fichiers uploadés
    ├── workspaces/                 # Workspaces des Kins
    ├── mini-apps/                  # Fichiers des mini-apps
    ├── storage/                    # File storage partagé
    └── vault/                      # Pièces jointes du coffre-fort
```
