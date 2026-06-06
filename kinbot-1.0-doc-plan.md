# KinBot 1.0 — Plan de documentation (Starlight)

> Source de vérité pour la doc utilisateur 1.0. Structurée **par pilier** (cf. messaging §5 et stratégie §3/§8), affinée pour coller au scaffold Starlight existant (`docs-site/src/content/docs/`). Principe directeur : **parité marketing ↔ doc** (chaque feature héros du site a sa page dédiée) et **bénéfice d'abord, feature ensuite**. Les docs internes obsolètes en structure (`idea.md`, `api.md`, `schema.md`…) ne sont pas publiées telles quelles : elles servent de **matière première** à miner.

---

## 0. Principes d'organisation

- **Ordre des sections = ordre des piliers** : (1) agents persistants qui se souviennent → (2) plateforme self-hosted & self-improving → (3) UI d'agents → (4) onboarding Sherpa → (5) omnicanal → (+) confiance/transparence. La nav suit ce fil narratif, pas l'ordre alphabétique ni l'ordre des tables SQL.
- **Catégorie** : la doc parle de « plateforme d'agents autonomes ». On évite le vocabulaire « front de chat » / « nouvelle conversation ».
- **Le terme « Kin »** est introduit une seule fois, tôt, dans *Concepts clés*, puis utilisé librement. En surface (titres de section, intro), on garde « agents » quand ça aide un nouveau venu.
- **Ton** : grand-public rassurant, concret, « ce que tu peux faire ». Honnêteté sur la maturité (renvoi vers une page *Limites & roadmap*).
- **Réutiliser le scaffold existant** : `getting-started/`, `kins/`, `channels/`, `mini-apps/`, `plugins/`, `providers/`, `memory/`, `api/`, `guides/` existent déjà. Le plan les réorganise sous les piliers sans casser les slugs déjà écrits.

---

## 1. Arborescence cible (sidebar Starlight)

```
Introduction
  Bienvenue
  Concepts clés (glossaire)
  Pourquoi KinBot (vs plateformes d'agents)

Démarrage (Getting Started)
  Installation (docker run, prérequis)
  Premier lancement & Sherpa
  Configurer ses providers
  Créer son premier Kin

Pilier 1 — Vos agents persistants
  Kins & identité
  Session continue
  Mémoire
  Sous-Kins (délégation)
  Collaboration inter-Kin
  Contacts
  Compacting & contexte long

Pilier 2 — Plateforme self-hosted & self-improving
  Toolboxes (composer les capacités)
  Outils personnalisés (custom tools + renderers)
  Mini-apps
  Plugins & SDK
  Serveurs MCP
  Providers (modèles, capacités)

Pilier 3 — L'interface (UI d'agents)
  Tour de l'interface & PWA
  Thèmes & apparence
  Rendu riche des outils
  Avatars

Pilier 4 — Onboarding & configuration (Sherpa)
  Sherpa, votre configurateur
  Règles globales & defaults
  Administration de la plateforme

Pilier 5 — Vos agents, partout (omnicanal)
  Vue d'ensemble des channels
  Telegram / Discord / Slack / WhatsApp / Signal / Matrix
  Transfert de canal
  Comptes connectés (mail · calendrier · contacts)

Automatisation
  Crons
  Webhooks
  Human-in-the-loop
  Scout
  Tâches & file d'attente

Projets
  Projets & contexte
  Kanban & tickets
  Intégration GitHub

Confiance & transparence (+)
  Vault & secrets
  Multi-utilisateur & isolation
  Transparence tokens & coûts
  Cache & calibration

Référence
  API REST
  Événements SSE
  SDK (@kinbot-developer/sdk)
  Configuration (variables d'env)

Aide
  Dépannage / FAQ
  Limites connues & roadmap
```

---

## 2. Détail par section (pages + scope une ligne + matière première à miner)

### Introduction

| Page | Scope (1 ligne) | Source à miner |
|---|---|---|
| `intro/welcome` | Ce qu'est KinBot, pour qui, en 60 secondes — pose la métaphore « équipe d'agents chez vous ». | `kinbot-1.0-messaging.md` (§1, §4) · `catalogue` (Introduction) |
| `intro/concepts` | **Glossaire des concepts clés** (voir §4 ci-dessous). | `catalogue` (carte des capacités) · `idea.md` |
| `intro/why-kinbot` | Positionnement vs plateformes d'agents autonomes + tableau des différenciateurs. | `strategie-communication.md` (§4 tableau) · `catalogue` (différenciateurs transversaux) |

### Démarrage

| Page | Scope | Source |
|---|---|---|
| `getting-started/installation` *(existe)* | `docker run`, prérequis, zéro infra externe, première connexion. | README · `config.md` · `catalogue §1` |
| `getting-started/first-launch-sherpa` | Le parcours 3 écrans puis passage en chat avec Sherpa. | `sherpa.md` · `catalogue §5` |
| `getting-started/configuration` *(existe)* | Brancher un provider LLM, réutilisation de clé = N capacités. | `config.md` · `sherpa.md` · `providers/supported.md` |
| `getting-started/first-kin` *(existe)* | Créer/nommer/spécialiser un premier Kin, choisir un modèle. | `idea.md` · `prompt-system.md` |

### Pilier 1 — Vos agents persistants

| Page | Scope | Source |
|---|---|---|
| `kins/overview` *(existe)* | Identité, expertise, caractère, modèle ; un Kin partagé par tous les utilisateurs. | `catalogue §1` · `prompt-system.md` · `idea.md` |
| `agents/continuous-session` | « Jamais de nouvelle conversation » : une session continue par Kin, queue FIFO + priorité utilisateur. | `idea.md` · `catalogue §1` |
| `kins/memory` *(existe)* / `memory/how-it-works` *(existe)* | Comment les Kins se souviennent : dual-channel, recherche hybride, catégories. | `catalogue §14` · `memory/*` · `kin-context-journal.md` · `compacting.md` |
| `agents/sub-kins` | Déléguer du travail à des sous-Kins éphémères (await vs async, profondeur). | `catalogue §1, §15` · `idea.md` |
| `agents/collaboration` | Communication inter-Kin request/reply, corrélation, anti-boucle. | `catalogue §1` · `teams-design.md` · `idea.md` |
| `agents/contacts` | Registre de contacts unifié (Kins + humains), notes scopées. | `contacts.md` · `catalogue §16` |
| `agents/context-compacting` | Pourquoi rien n'est supprimé ; compacting 3 zones, fenêtre LLM, récupération tardive. | `compacting.md` · `catalogue §1, §11` |

### Pilier 2 — Self-hosted & self-improving

| Page | Scope | Source |
|---|---|---|
| `kins/tools` *(existe)* | Les outils natifs : ce qu'un Kin peut faire out-of-the-box. | `idea.md` · `catalogue §1, §16` |
| `extending/toolboxes` | Composer les capacités par rôle (allow-lists, 9 toolboxes, wildcard). | `catalogue §10` |
| `extending/custom-tools` | Créer des outils multi-langage + renderer React (validation bi-phase). | `catalogue §3` · `mini-apps-journal.md` |
| `mini-apps/overview` *(+ sous-pages existantes)* | Construire de vraies apps web themées : SDK, hooks, composants, backend, dev loop. | `mini-apps/*` · `mini-apps-journal.md` · `catalogue §4` |
| `plugins/overview` *(+ sous-pages existantes)* | Plugins NPM, SDK typé, marketplace, permissions. | `plugins/*` · `PLUGIN-SPEC.md` · `PLUGIN-DEVELOPMENT.md` · `catalogue §9` |
| `extending/mcp` | Ajouter des serveurs MCP dynamiquement (discovery, approval, naming). | `catalogue §16` · `idea.md` |
| `providers/supported` *(existe)* / `providers/custom` *(existe)* | Un config = N capacités (llm/embedding/image/search/stt/tts) auto-détectées. | `config.md` · `catalogue §8, §9, §16` |

### Pilier 3 — L'interface

| Page | Scope | Source |
|---|---|---|
| `ui/tour-pwa` | Tour de l'UI (sidebar Kins, fil, viewers) + installation PWA, offline. | `frontend-perf-journal.md` · `catalogue §2` · `DesignSystemPage.tsx` |
| `ui/themes` | 18 palettes, contraste adaptatif, light/dark, sync multi-device. | `catalogue §2` · `globals.css` · `theme-provider.tsx` · `docs-theme-journal.md` |
| `ui/rich-tool-rendering` | Pourquoi les résultats d'outils s'affichent en cartes themées, pas en JSON. | `catalogue §3` · `mini-apps-journal.md` |
| `ui/avatars` | Avatars auto-générés : 3 axes (art/sujet/caractère), base neutre, modes. | `catalogue §6` · `idea.md` |

### Pilier 4 — Onboarding & configuration

| Page | Scope | Source |
|---|---|---|
| `sherpa/overview` | Sherpa = configurateur conversationnel permanent ; ce qu'il peut/ne peut pas faire. | `sherpa.md` · `sherpa-knowledge.md` · `catalogue §5` |
| `sherpa/global-rules-defaults` | Règles globales injectées à chaque Kin + defaults par capacité. | `sherpa.md` · `prompt-system.md` · `catalogue §5` |
| `admin/platform` | Config plateforme (env guidé), logs, SQL direct, restart, sauvegardes/migrations. | `config.md` · `catalogue §16` · `TROUBLESHOOTING.md` |

### Pilier 5 — Vos agents, partout

| Page | Scope | Source |
|---|---|---|
| `channels/overview` *(existe)* | Modèle omnicanal : 6 plateformes, liaison Kin↔canal mutable, identité. | `catalogue §12` · `channel-files-journal.md` |
| `channels/{telegram,discord,slack,whatsapp,signal,matrix}` *(existent)* | Une page par plateforme : connexion, auth, secrets vaultés, limites. | `catalogue §12` · code adaptateurs |
| `channels/transfer` | Transfert dynamique de canal entre Kins en temps réel + chaîne de causalité. | `catalogue §12` · `channel-files-journal.md` |
| `connected-accounts/email` | Lire/envoyer du mail (Gmail, 365, IMAP/SMTP), approbation d'envoi. | `email.md` · `catalogue §8` |
| `connected-accounts/calendar` | CRUD d'événements (Google/M365/CalDAV). | `calendar.md` · `catalogue §8` |
| `connected-accounts/contacts` | Recherche read-only de carnets externes (jamais copiés). | `contacts.md` · `catalogue §8` |
| `connected-accounts/oauth-imap-caldav` | Mécanique OAuth2 / IMAP / CalDAV, tokens jamais vus par les Kins. | `email.md` · `calendar.md` · `catalogue §8` |

### Automatisation

| Page | Scope | Source |
|---|---|---|
| `automation/crons` | Planifier des sous-Kins (POSIX/ISO8601, one-shot, learnings, approbation). | `catalogue §15` · `cron-manager-journal.md` · `guides/autonomy-quickstart.md` |
| `automation/webhooks` | Déclencheurs externes (token, filtrage, templates, dispatch). | `catalogue §15` · `api.md` |
| `automation/human-in-the-loop` | Pauses interactives `prompt_human` (confirm/select/text). | `catalogue §15` |
| `automation/scout` | Délégation read-only à un modèle cheap (chaîne de résolution). | `catalogue §15, §10` |
| `automation/tasks-queue` | File globale, groupes de concurrence, contexte gelé au spawn. | `catalogue §15` · `task-latency-analysis.md` |

*(les blueprints existants `guides/blueprints/*` deviennent des tutoriels rattachés à cette section)*

### Projets

| Page | Scope | Source |
|---|---|---|
| `projects/overview` | Projets, contexte injecté, connaissances épinglées, projet actif par Kin. | `projects.md` · `catalogue §7` |
| `projects/kanban-tickets` | Kanban 5 colonnes, tickets, tags, sous-tâches sur ticket, enrichissement. | `projects.md` · `catalogue §7` |
| `projects/github` | Clone auto + worktrees isolés par sous-tâche, PAT vaulté. | `projects.md` · `catalogue §7` |

### Confiance & transparence (+)

| Page | Scope | Source |
|---|---|---|
| `security/vault` | Coffre AES-256-GCM, références `$vault:`, saisie sécurisée, redaction. | `catalogue §13` · `SECURITY.md` · `sherpa.md` |
| `security/multi-user` | Isolation multi-utilisateur, quick-sessions, notes scopées. | `catalogue §16` · `idea.md` |
| `transparency/tokens-costs` | Context Viewer, breakdown par section, « zéro surprise de coûts ». | `catalogue §11` · `kin-context-journal.md` |
| `transparency/cache-calibration` | Observabilité cache Anthropic + calibration EMA per-Kin. | `catalogue §11` · `compacting.md` |

### Référence

| Page | Scope | Source |
|---|---|---|
| `api/rest` *(existe)* | Contrats REST par route. | `api.md` |
| `api/sse` *(existe)* | Catalogue des événements SSE et règles emit↔handle. | `sse.md` · `api.md` |
| `reference/sdk` | API du SDK `@kinbot-developer/sdk` (plugins + mini-apps). | `plugins/api.md` · `mini-apps/sdk-reference.md` · `PLUGIN-SPEC.md` |
| `reference/configuration` | Toutes les variables d'env et defaults. | `config.md` |

### Aide

| Page | Scope | Source |
|---|---|---|
| `help/troubleshooting` | Problèmes fréquents + FAQ. | `TROUBLESHOOTING.md` · `qa-journal.md` |
| `help/limits-roadmap` | Maturité par domaine, rough edges assumés, post-1.0. | `catalogue` (section « Honnêteté : limites ») · `strategie §6` |

---

## 3. Parité marketing ↔ doc (8 features héros du site → page dédiée)

D'après `strategie §5` (les 8 sections héros de la home). Chaque section marketing doit pointer vers **une** page doc canonique.

| # | Feature héros (site) | Page doc cible |
|---|---|---|
| 1 | L'équipe de Kins en action (collaboration inter-agents) | `agents/collaboration` (+ `agents/sub-kins`) |
| 2 | Sherpa : votre setup en conversation | `getting-started/first-launch-sherpa` → `sherpa/overview` |
| 3 | Une mémoire qui ne s'efface pas | `memory/how-it-works` (+ `agents/context-compacting`) |
| 4 | Vos agents, partout (omnicanal + transfert) | `channels/overview` → `channels/transfer` |
| 5 | Des outils custom avec une vraie UI | `extending/custom-tools` |
| 6 | Des mini-apps construites par vos Kins | `mini-apps/overview` |
| 7 | Vos secrets ne voient jamais le LLM | `security/vault` |
| 8 | Zéro surprise de coûts (transparence tokens) | `transparency/tokens-costs` |

Features « preuve » plus légères du site (avatars, 18 palettes, projets/Kanban, crons/webhooks/HITL, comptes connectés, PWA) → pages déjà prévues : `ui/avatars`, `ui/themes`, `projects/*`, `automation/*`, `connected-accounts/*`, `ui/tour-pwa`.

---

## 4. Section « Concepts clés » (glossaire — page `intro/concepts`)

Page unique, courte, chaque entrée = 2-3 phrases + lien vers la page approfondie. C'est le seul endroit où l'on **définit** le vocabulaire propriétaire.

- **Kin** — un agent persistant avec une identité, une expertise, une mémoire et des outils. Partagé par tous les utilisateurs de l'instance. → `kins/overview`
- **Session continue** — un seul fil ininterrompu par Kin ; il n'y a pas de « nouvelle conversation ». Le contexte ancien est résumé, jamais supprimé. → `agents/continuous-session`
- **Mémoire** — savoir long terme hybride (sémantique + texte) que le Kin accumule automatiquement et via l'outil `memorize` ; catégories fact/preference/decision/knowledge. → `memory/how-it-works`
- **Sous-Kin (tâche)** — instance éphémère qu'un Kin spawn pour déléguer un travail ; mode `await` (le parent attend) ou `async` (fond). → `agents/sub-kins`
- **Toolbox** — liste nommée d'outils autorisés assignée à un Kin/une tâche, qui compose ses capacités par-dessus un socle obligatoire. → `extending/toolboxes`
- **Channel binding** — la liaison mutable entre un Kin et un canal de messagerie ; on peut transférer le canal d'un Kin à l'autre sans changer d'adresse. → `channels/transfer`
- **Vault** — coffre chiffré (AES-256-GCM) où vivent les secrets ; jamais injecté dans le prompt, le LLM ne voit que des références/confirmations. → `security/vault`

*(Entrées secondaires possibles si la place le permet : Compacting, Scout, Mini-app, Provider, Sherpa — mais les 7 ci-dessus sont le minimum demandé et suffisent au glossaire 1.0.)*

---

## 5. Ordre de rédaction recommandé pour 1.0

Priorisé par : (a) débloquer un nouvel utilisateur de bout en bout, (b) couvrir les 8 héros (parité site), (c) le reste.

**Vague 1 — « Un visiteur peut installer et comprendre » (bloquant lancement)**
1. `intro/welcome`
2. `intro/concepts` (glossaire) — débloque tout le vocabulaire des autres pages
3. `getting-started/installation`
4. `getting-started/first-launch-sherpa`
5. `getting-started/configuration`
6. `getting-started/first-kin`

**Vague 2 — Les 8 héros (parité marketing, le « pourquoi »)**
7. `memory/how-it-works` (héros 3)
8. `agents/collaboration` + `agents/sub-kins` (héros 1)
9. `sherpa/overview` (héros 2)
10. `channels/overview` + `channels/transfer` (héros 4)
11. `security/vault` (héros 7)
12. `transparency/tokens-costs` (héros 8)
13. `extending/custom-tools` (héros 5)
14. `mini-apps/overview` (héros 6)

**Vague 3 — Compléter les piliers**
15. `kins/overview`, `agents/continuous-session`, `agents/context-compacting`, `agents/contacts`
16. `extending/toolboxes`, `extending/mcp`, `plugins/overview`, `providers/*`
17. `ui/tour-pwa`, `ui/themes`, `ui/avatars`, `ui/rich-tool-rendering`
18. `channels/{6 plateformes}`, `connected-accounts/*`
19. `intro/why-kinbot`

**Vague 4 — Profondeur & power-user**
20. `automation/*`, `projects/*`
21. `security/multi-user`, `transparency/cache-calibration`
22. `sherpa/global-rules-defaults`, `admin/platform`

**Vague 5 — Référence & filet de sécurité**
23. `reference/configuration`, `api/rest`, `api/sse`, `reference/sdk`
24. `help/troubleshooting`, `help/limits-roadmap` (assume la maturité ~80%, aligné ADN transparence)

---

## 6. Notes d'exécution

- **Réemploi du scaffold** : les pages marquées *(existe)* sont déjà dans `docs-site/src/content/docs/`. Vague 1-2 = surtout réorganiser la sidebar (`astro.config`/sidebar Starlight) selon §1 + écrire les nouvelles pages `intro/*`, `agents/*`, `sherpa/*`, `security/*`, `transparency/*`, `connected-accounts/*`, `automation/*`, `projects/*`, `ui/*`.
- **Les `demo_ideas` du catalogue** (`strategie §5`, `script-video.md`) sont d'excellents canevas de tutoriels en tête de chaque page héros (GIF + 3 étapes).
- **Ne pas publier en l'état** : `idea.md`, `schema.md`, `api.md`, `sse.md`, `prompt-system.md`, `compacting.md`, `sherpa.md`, les `*-journal.md`, `teams-design.md` — ce sont des sources internes à reformuler en langage bénéfice-d'abord.
- **Pages clés à signaler comme prioritaires hors-vague si le temps manque** : le glossaire (`intro/concepts`) et `getting-started/first-launch-sherpa` portent à eux seuls la compréhension + l'activation du produit.

Fichiers de référence (chemins absolus) : `/Users/nicolasvarrot/projects/kinbot/kinbot-1.0-messaging.md`, `/Users/nicolasvarrot/projects/kinbot/kinbot-1.0-strategie-communication.md`, `/Users/nicolasvarrot/projects/kinbot/kinbot-1.0-catalogue-capacites.md`, scaffold Starlight existant `/Users/nicolasvarrot/projects/kinbot/docs-site/src/content/docs/`.