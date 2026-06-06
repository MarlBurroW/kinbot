# KinBot 1.0 — Catalogue maître des capacités

> Document de référence interne. Source unique de vérité pour reconstruire le dépôt, le site GitHub Pages et la documentation. Synthèse de 16 dossiers de capacités extraits du code réel + veille concurrentielle.

## Introduction — L'essence de KinBot

KinBot est une **plateforme auto-hébergée d'agents IA spécialisés** — les *Kins* — pensée pour les individus et les petits groupes. Tout tient dans **un seul processus, une seule base SQLite, un seul conteneur Docker**, sans aucune dépendance d'infrastructure externe (pas de Postgres, Redis, MongoDB, SearxNG ni broker de queue). `docker run kinbot`, on connecte une clé LLM, et c'est complet.

Là où le marché s'est figé sur deux paradigmes — les *conversations* classiques (ChatGPT, LibreChat, Open WebUI) ou les *workflows* pour développeurs (Dify, n8n, Flowise) — KinBot propose une troisième voie : une **équipe d'agents persistants**. Chaque Kin a une identité stable, une expertise, une mémoire long terme et des outils. Les Kins partagent **une session continue unique** (jamais de « nouvelle conversation »), **collaborent entre eux**, **spawnent des sous-Kins** pour déléguer du travail, et **exécutent des tâches planifiées**. La plateforme **grandit avec l'utilisateur** : un onboarding entièrement conversationnel (Sherpa), des mini-apps construites par les Kins, un marketplace de plugins NPM, et une transparence radicale sur les coûts.

Le positionnement est précis : *la simplicité d'un assistant grand public, en self-hosted souverain, sur votre serveur* — une intersection que personne d'autre n'occupe aujourd'hui.

---

## Carte des capacités

### 1. Architecture & runtime des Kins

**Le pitch.** Plateforme monoprocess auto-hébergée où des Kins spécialisés à identité persistante partagent une session continue, mémorisent sur des mois, et orchestrent du travail asynchrone via une queue FIFO à priorité utilisateur.

**Ce que c'est.** Le cœur de KinBot : un moteur Bun + SQLite servant des micro-agents collaboratifs. Chaque Kin possède une **session principale continue** (tous les utilisateurs conversent dans le même fil), une queue FIFO sérialisée (max 1 tour LLM à la fois), et s'appuie sur un compacting progressif + une mémoire hybride pour rester exploitable sur des mois de contexte. Un bus d'événements global et un système de hooks fondent l'extensibilité. Les sous-Kins (tâches éphémères) et la messagerie inter-Kins permettent l'orchestration autonome.

**Les capacités clés.**
- **Identité et expertise persistantes** par Kin (nom, rôle, caractère, expertise, avatar, modèle), partagées entre tous les utilisateurs ; chaque message est tagué avec l'expéditeur ; réponse multilingue selon la langue du dernier locuteur (`schema.ts:88-118`, table `kins`).
- **Session unique continue** sans reset d'historique — le Kin sait toujours où il en est (`kin-engine.ts`).
- **Mémoire long terme hybride** : extraction auto post-compacting, recherche sémantique (sqlite-vec KNN) + mots-clés (FTS5), outils `recall/memorize/update_memory/forget`, catégories fact/preference/decision/knowledge.
- **Compacting progressif 3 zones + merge télescopique** : zones intacte/tronquée/réduite en mémoire, puis keep-window LLM token-aware (cap 100k), fusion télescopique des plus vieux résumés ; trigger à 75 % du context window ou 300k tokens absolus.
- **Queue FIFO sérialisée par Kin + priorité utilisateur** : les messages utilisateur passent en tête, éliminant les race conditions sur le contexte partagé.
- **Sous-Kins (tâches) en modes await/async** : `await` = le parent suspend et reprend au retour ; `async` = exécution silencieuse de fond. Profondeur max 3. Outils `report_to_parent/update_task_status/request_input`.
- **Messagerie inter-Kins** : `request` (enqueue + LLM turn) / `inform` (dépôt direct), `reply(request_id)` toujours `inform`, rate-limiting + chain depth pour éviter les boucles.
- **Prompt dynamique à 12 blocs** : préfixe stable cache-friendly (identité, principes, caractère, expertise, contacts compacts, workspace) + segment volatile (mémoires, speaker, langue, projet actif).
- **Registre de contacts** unifiant Kins et humains (identifiants multi-plateforme, notes globales/privées).
- **Crons** (croner) spawnant des sous-Kins async ; **bus d'événements + hooks** (beforeChat, afterToolCall, etc.) à handlers isolés.
- **Prompt cache Anthropic natif** (préfixe stable ~12-15k tokens cachés, économie ~90 % turn-to-turn).
- **50+ outils natifs**, **outils MCP stateful**, **custom tools any-language**, **toolboxes** (allow-lists par scope), **streaming SSE** à traitement de tool-calls à la volée, **navigateur stateful** (14 outils `browser_*`, Playwright + stealth + accessibility snapshot).

**Les prouesses techniques.** Moteur monoprocess Bun zéro-infra ; sérialisation FIFO garantie ; compacting sans suppression des originaux (récupération tardive via `search_history`) ; mémoire hybride 3x+ plus rapide que vecteurs seuls ; prompt cache invalidant uniquement le volatile ; browser à refs dynamiques `e1, e2` (pas de CSS fragile) avec cookies persistés cross-session.

**Wow factor : 4/5.**

---

### 2. UI/UX, PWA, Design System & Theming

**Le pitch.** Interface ultra-polie : 18 palettes Aurora, mode contraste adaptatif, PWA native, design system Radix cohérent avec effets visuels sophistiqués.

**Ce que c'est.** Frontend React + Tailwind avec moteur de thématisation propriétaire (18 palettes en OKLch × light/dark × normal/soft), PWA complète (Service Worker, manifeste, cache stale-while-revalidate), 39 composants UI Radix, i18n 4 langues (3400+ clés), responsive mobile-first, accessibilité WCAG AA, et 21 keyframes de micro-interactions.

**Les capacités clés.**
- **18 palettes Aurora** (aurora, ocean, forest, sunset, monochrome, sakura, neon, lavender, midnight, copper, jade, crimson, galaxy, amber, slate, rose, mint, citrus), chacune en OKLch × 3 gradients × light/dark (`theme-provider.tsx:18-127`).
- **Contraste adaptatif 2-tiers** (normal/soft) via `data-contrast`, DB-synced cross-device (`globals.css:1193-1310`).
- **Light/dark/system** avec script anti-flicker inline (zéro CLS au load).
- **PWA standalone** : app shell pré-caché, network-first pour les nav HTML, stale-while-revalidate pour les assets, API/SSE toujours bypass cache (`sw.js`).
- **Composants Radix complets** (Button 6 variantes × 7 tailles, dialogs, sheets, command, etc.) avec focus-visible rings 3px.
- **Design System Page** interactive (2760 lignes, 20+ sections, dev-only).
- **i18n EN/FR/DE/ES** (en.json 3399 / fr.json 3693 / de.json 2969 / es.json 2970 clés).
- **Responsive 768px** + sidebar collapsible + `h-dvh` mobile.
- **Glass morphism + surfaces gradient** (`surface-card/header/sidebar/chat`, `gradient-mesh`).
- **Performance** : code splitting lazy + 17 composants `React.memo` (ChatPage 405KB vs 590KB avant).
- **Theme DB sync** multi-device, **markdown + syntax highlight** rose-pine, **Tailwind 4.2** via `@theme`.

**Les prouesses techniques.** OKLch (contraste perceptuel uniforme, soft mode redéfinit la luminance sans shift de hue) ; SW hand-coded sans Workbox (surface minimale) ; anti-flicker avant first paint ; lazy `ProviderIcon` (-263KB initial) ; ~11k chaînes i18n avec pluralization.

**Wow factor : 5/5.**

---

### 3. Outils personnalisés + renderers riches

**Le pitch.** Les Kins créent des outils custom multi-langage avec leurs dépendances, et chaque outil affiche ses résultats dans une UI React personnalisée — pas du JSON brut.

**Ce que c'est.** Plateforme d'authoring d'outils globaux (Python/Node/Bun/TS/Bash/Deno) avec gestion native des dépendances (pip, bun install). Chaque outil peut embarquer un `renderer.tsx` bundlé côté serveur (Bun.build), validé en SSR avant déploiement, livré au client en module ESM content-addressed. Les outils natifs ont eux aussi des renderers riches.

**Les capacités clés.**
- **Création multi-langage** via `create_custom_tool` (slug immutable, entrypoint, schéma JSON) ; activation immédiate sous `custom_<slug>` (`custom-tools.ts:130-170`).
- **Gestion des dépendances** : `run_custom_tool_setup` détecte `requirements.txt` → `.venv`+pip, ou `package.json` → bun install, isolé par outil.
- **Exécution avec résolution d'interprète** (langage explicite → shebang → extension → Bun ; `.venv` préféré pour Python), args JSON sur stdin, timeout 1-300s, output capé.
- **Renderers riches** : `renderer.tsx` bundlé via Bun.build, React mappé sur les globals de l'hôte (`window.__KINBOT_REACT__`), module ESM minifié (`custom-tool-renderer.ts:1-256`).
- **Validation bi-phase** (build + SSR `renderToStaticMarkup`) avant sauvegarde, erreurs rapportées au Kin (`:344-384`).
- **Livraison lazy + cache mtime-addressé** : URL `?v=<mtime>` cachée éternellement, busting auto sur édition ; cache module-level `slug:version` sans re-suspension.
- **UI_KIT themé** (12 primitives sans dépendance externe : Card, Section, Badge, Stat, Table, Code…) auto-themé via tokens CSS.
- **Traductions UI-only** per-locale (n'altèrent pas la schéma LLM), **domaines d'outils** (couleur + icône), **renderers natifs** pour 20+ outils intégrés, **`test_custom_tool`** validant script + renderer en un appel, **scoping par toolbox**.

**Les prouesses techniques.** Bundling serveur une fois au save ; host-context React (hooks/suspense natifs) ; validation bi-phase captant 99 % des erreurs sans navigateur ; cleanup du process tree au timeout ; content-addressed ESM immutable.

**Wow factor : 4/5.**

---

### 4. Mini-apps intégrées

**Le pitch.** Les Kins construisent de vraies applications web complètes intégrées nativement, themées automatiquement, avec stockage persistant, backend optionnel et boucle de dev instantanée.

**Ce que c'est.** Plateforme permettant aux Kins de bâtir, déployer et itérer des apps web réactives dans un iframe cloisonné, avec un SDK JS riche (KinBot SDK : storage, API, mémoire, conversation, thème, SSE), une bibliothèque React (24 hooks + 50+ composants pré-stylisés), un backend optionnel Hono (`_server.js`), versioning/snapshots, et 11 templates + showcase.

**Les capacités clés.**
- **Création en une instruction** (`create_mini_app` : HTML brut, template ou map de fichiers ; auto-`app.json`) (`mini-app-tools.ts:43-154`).
- **SDK JS vanille (1203 LOC)** : thème réactif, storage cloisonné, `api()`/`http()` proxy CORS, send message au Kin, dialogs, notifications, `memory.search/store`, `conversation.history/send`, `share()` inter-app, SSE temps-réel, console interception.
- **24 React hooks (1462 LOC)** : `useKinBot`, `useStorage`, `useForm`, `useMemory`, `useConversation`, `useEventStream`, `useInfiniteScroll`, `usePagination`, etc.
- **50+ composants (5610 LOC)** : DataGrid sortable/filtrable, Modal, Drawer, BarChart/LineChart/PieChart/SparkLine, Kanban, Stepper, Calendar — tous themés via CSS variables.
- **Backend optionnel** (`_server.js` factory Hono, storage namespaced, events SSE), compilé en cache avec cache-busting.
- **Gestion des dépendances** (app.json shorthand, importmap, inline) + `.d.ts` TypeScript servis.
- **Dev itératif** : *improve* (suggestions utilisateur → Kin maintaineur), *console* (ring buffer 50, `get_mini_app_console`), *docs* (typage complet).
- **Stockage + snapshots** (KV 64KB/clé, max 500 clés, 20 snapshots auto-prune, rollback), **icône IA optionnelle**, **galerie publique** (`browse_mini_apps`, clone), **11 templates + showcase**, **reload transparent** (versioning + SSE), **cloisonnement iframe + CSP**, **réassignation maintainer**.

**Les prouesses techniques.** Module resolution dynamique cache-bustée pour les backends ; AppEventEmitter SSE per-app ; console interception (proxy + ring buffer) ; `validatePath` anti-traversal ; postMessage choreography (app-meta, dialogs, clipboard, shared-data) ; charts SVG (courbes Catmull-Rom, donut geometry).

**Wow factor : 4/5.**

---

### 5. Onboarding conversationnel (Sherpa)

**Le pitch.** Une IA configuratrice permanente qui guide toute la plateforme par conversation — zéro CLI, zéro YAML, accessible aux non-techniciens.

**Ce que c'est.** Sherpa est un Kin spécialisé (`kind=configurator`) créé au premier lancement, doté d'une toolbox dédiée (45+ outils) pour tout configurer en chat. L'onboarding est minimal (3 écrans : identité + langue + 1 provider LLM), puis Sherpa prend le relais pour les providers additionnels, les channels, les avatars, les règles globales et les premiers Kins. Il reste accessible à vie.

**Les capacités clés.**
- **Onboarding minimal 3 étapes** puis conversation guidée (`OnboardingPage.tsx`, `StepBootstrapProvider.tsx`).
- **Seed automatique idempotent** de Sherpa après validation du provider, sélection de modèle adaptive (`configurator.ts:62-132`).
- **Conversation step-by-step** via bloc `[Configurator mission]` injecté uniquement si `kind==='configurator'`.
- **Secure input pour les secrets** (`request_provider_setup`, `request_channel_setup`, `prompt_secret`) : modale client → vault AES-256-GCM, **jamais au LLM**, seulement une confirmation non sensible (`secure-input-tools.ts`).
- **Connexion de providers + réutilisation de clés** (`describe_provider_config`, `test_provider`, `enable_provider_capability` : une clé OpenAI = N capacités).
- **Configuration des defaults** (modèles + providers par capacité), **règles globales** (`get/set_global_prompt`, bloc `[3.5]` injecté à chaque Kin), **création de Kins**, **avatars** (3 axes), **channels** en chat, **composition de toolboxes minimales**, **gestion du contact utilisateur**, **mémoire explicite**, **web search**, **base de connaissances injectable** (`sherpa-knowledge.md`), **propositions data-driven** selon profil + état courant, **persistance conversationnelle** (thread principal), **avatar bundlé**, **guardrail admin-only**.

**Les prouesses techniques.** Workflow 2 phases (formulaires minimaux → chat) déverrouillant l'UI avant config complète ; secure input atomique (créer + tester + reprendre le tour avec confirmation) ; blocs prompt conditionnels cachés dans le segment stable ; idempotence du seed ; reuse de capabilities ; knowledge base maintenue en sync.

**Wow factor : 5/5.** *(Différenciateur d'adoption grand public majeur — aucun concurrent self-hosted n'a d'équivalent.)*

---

### 6. Avatars auto-générés & personnalisation

**Le pitch.** Chaque Kin reçoit un avatar auto-généré, personnalisable via 3 axes indépendants (art, sujet, caractère), adapté à sa personnalité, avec base de référence neutre pour la cohérence visuelle.

**Ce que c'est.** Pipeline end-to-end de génération d'images : un LLM prompt-writer réécrit chaque prompt en intégrant le style global, le type de sujet et l'identité du Kin, guidant le modèle d'image vers un headshot serré. Modes text-to-image ou image-to-image (base neutre customisable).

**Les capacités clés.**
- **Génération auto-complète par Kin** (flag `generate_avatar`, exploite name/role/character/expertise) (`kins.ts:465-535`).
- **3 axes indépendants** : style artistique global (Pixar 3D, anime, watercolor…), sujet/type (robot, humain, elfe…), caractère per-Kin inféré (stockés en `app_settings`).
- **LLM prompt-writer** : réécrit le prompt complet, injecte les contraintes de cadrage (headshot strict), filtre silencieusement l'impossible (« wields sword » → emblème ; `image-generation.ts:484-554`).
- **Image-to-image (edit mode)** avec base neutre custom uploadable/générable, fallback text-to-image.
- **UI 3 modes** (Upload + crop, Auto, Manual) avec ModelPicker, **adaptation par expertise**, **wizard avec preview en background**, **stockage cache-busté**, **presets + aide i18n**, **résolution provider fallback**.

**Les prouesses techniques.** Double-dispatch (LLM réécrit contextuellement, pas de concaténation de template) ; contraintes de cadrage strictes dans le system prompt ; filtrage silencieux ; chaîne fallback img2img→txt2img ; base neutre pour cohérence cross-Kins sans tweak par-agent ; dual LLM path (prompt cheap, image render) ; token tracking ; abort signal.

**Wow factor : 4/5.** *(Touche grand public absente des concurrents.)*

---

### 7. Projets, Kanban, tickets & intégration GitHub

**Le pitch.** Gestion de projets complète : Kanban 5 colonnes, tickets multi-statuts, tags par projet, tâches Kins à contexte injecté, enrichissement automatisé, et worktrees GitHub isolés par sous-tâche.

**Ce que c'est.** Chaque projet regroupe un contexte injectable, des tickets en kanban (Backlog/À faire/En cours/Bloqué/Terminé), des tags, des connaissances épinglées. Les Kins gèrent les tickets (CRUD + kanban) et spawnent des sous-tâches liées à un ticket recevant le contexte complet. GitHub : clone auto + worktree par sous-tâche.

**Les capacités clés.**
- **CRUD projets** (titre, description injectée, githubRepo, modèles par défaut) (`projects.ts`).
- **Kanban 5 colonnes drag&drop** (dnd-kit, optimistic updates, SSE) ; vue mobile une colonne (`ProjectKanban.tsx`).
- **Tickets** (description append si >500 chars, position 1024-gap, tags N-N, commentaires, attachments, historique de tâches, mentions `#N`/`slug#N`/UUID).
- **Tags par projet** (label + couleur, seed bug/feature/chore/doc).
- **Sous-tâches sur ticket en await obligatoire** : contexte projet+ticket dans bloc `Ticket assignment`, result enrichi `[Linked ticket: #X]` (`tickets.ts:startTicketTask`).
- **Enrichissement automatisé** (`startTicketEnrichment`, agent `kind=enrich`, append-mode, guard rails).
- **Contexte projet actif** par Kin (bloc volatile, 50 tickets non-done), **connaissances pinglées** (FTS + embeddings), **intégration GitHub** (clone background, worktree `repos/worktrees/<slug>-task-<hex>`, branche dédiée, PAT vault via credential helper jamais en URL), **repo picker UI**, **~25 outils Kin**, **API REST complète + SSE**, **historique tâches/commentaires**, **métriques temps-réel** (Kins courants, chrono), **UI multi-vue**.

**Les prouesses techniques.** Optimistic + dnd-kit (pointerWithin+rectIntersection) ; séparation stable/volatile cache-aware ; numérotation monotone per-projet (index composé) ; worktrees isolés (PAT en `$KINBOT_GH_TOKEN`, git ops via Bun.spawn) ; mention resolution batchée (max 50/call) ; position gap-based.

**Wow factor : 4/5.**

---

### 8. Comptes connectés (mail, calendrier, contacts)

**Le pitch.** Les Kins accèdent au mail, calendrier et carnet d'adresses via OAuth ou identifiants chiffrés, sans quitter votre infrastructure auto-hébergée.

**Ce que c'est.** Accès natif et contrôlé : lire/envoyer des emails, consulter/créer des événements, chercher des contacts externes. Identifiants chiffrés au repos, tokens OAuth gérés côté serveur (jamais exposés aux Kins), accès restreignable par Kin, mode approbation optionnel.

**Les capacités clés.**
- **OAuth2 multi-fournisseur générique** (Google, Microsoft 365, Apple) — l'hôte gère le flux, chaque provider déclare endpoints+scopes (`oauth.ts`, `email-accounts.ts`).
- **Accès mail** (Gmail, Outlook/365, IMAP/SMTP) : lire/lister/chercher/envoyer, HTML, pièces jointes, recherche structurée ou requête native (Gmail query, KQL).
- **Événements calendrier** (Google, M365, iCloud CalDAV, CalDAV générique) : CRUD, all-day, fuseaux, participants.
- **Recherche de contacts read-only** (iCloud, Google People, MS Graph, CardDAV) — jamais copiés dans KinBot.
- **Caching tokens + cycle de vie OAuth** (refresh 1 min avant expiration, jamais vus par les Kins), **approbation humaine d'envoi** (mode direct/approval), **restriction par Kin** (allow-list), **chiffrement au repos** (`configEncrypted`), **architecture fournisseur pluggable** (SDK).

**Les prouesses techniques.** OAuth2 agnostique (un plugin = un provider sans fork) ; cycle de vie multi-niveaux (refresh chiffré en DB, access caché en mémoire) ; résolution unifiée (slug → défaut → premier valide) ; IMAP/CalDAV via imapflow+nodemailer+tsdav+ical.js (pas de SDK géants) ; capacités unifiées (un provider = email+contacts+calendar).

**Wow factor : 4/5.**

---

### 9. Système de plugins, SDK & marketplace

**Le pitch.** Système de plugins NPM orienté développeurs, SDK TypeScript typé, marketplace de découverte intégré — 100 % self-hosted, sans cloud propriétaire.

**Ce que c'est.** Plugins déclaratifs (manifest JSON + index.ts) ajoutant outils, fournisseurs natifs (9 types), adaptateurs de channels, hooks et cartes interactives. Installation via npm, Git ou Settings → Plugins → Browse (recherche npm live). Permissions granulaires runtime-enforced.

**Les capacités clés.**
- **Marketplace NPM intégré** (keyword `kinbot-plugin`, recherche registry.npmjs.org live, cache 5 min, logo via unpkg, détection installés).
- **SDK TypeScript** (`@kinbot-developer/sdk`) : helper `tool()` à inférence zod, hiérarchie d'erreurs, 9 interfaces natives.
- **Installation multi-source** (npm/git) + mises à jour + topological sort des dépendances.
- **Manifest déclaratif** strict (name, version, permissions `http:<host>`/`storage`/`vault`/`cron`/`kins`, config schema).
- **Outils IA natifs** (factory `create` recevant ToolExecutionContext, flags readOnly/concurrencySafe/destructive, préfixe auto `plugin_<nom>_<outil>`).
- **6+ fournisseurs natifs** (LLM, embedding, image, search, TTS, STT + email/contacts/calendar) à interface identique aux built-ins.
- **Adaptateurs de channels** (config schema dynamique, secrets auto-vaultés), **hooks lifecycle** (beforeChat/afterChat/before/afterToolCall), **cartes interactives** à état persisté, **API storage par plugin**, **HTTP permission-controlled**, **vault namespacé**, **scaffold CLI** (`create-kinbot-plugin`), **config typée + UI dynamique**, **auto-disable on error**, **espaces de noms auto-préfixés**.

**Les prouesses techniques.** SDK lean (zod + types + 9 interfaces) ; NPM discovery pipeline ; context factory frais par tour ; permission model granulaire runtime ; hot reload via fs.watch ; topological sort avec détection de cycles ; PluginHealthStats auto-disable ; hook payload typing discriminé.

**Wow factor : 4/5.**

---

### 10. Toolboxes & scoping des outils

**Le pitch.** Composez dynamiquement les capacités de chaque Kin via des toolboxes nommées — réduisez les coûts et les hallucinations en ciblant précisément l'outillage par rôle.

**Ce que c'est.** Système de toolboxes (allow-lists nommées) assignables aux Kins ou aux tâches/crons/webhooks. Une entité reçoit l'union d'un floor obligatoire (CORE_TOOLS) + chaque toolbox. Unifie 4 sources d'outils (native, plugin, MCP, custom) sous un seul mécanisme de grant.

**Les capacités clés.**
- **Composition dynamique** CORE_TOOLS ∪ toolboxes, résolue à chaque tour (hot-reload sans redémarrage) (`toolset-resolver.ts`).
- **9 toolboxes intégrées** : code, research, ops, scout, all, email, calendar, address-book, configurator (`toolboxes.ts`).
- **Wildcard intelligent** : `all`/`*` étend aux natifs + custom activés, **jamais** MCP/plugin (qui restent explicites).
- **Assignation flexible** (Kin persistant, tâche/cron/webhook override), **résolution noms→IDs** avec fallback gracieux.
- **CRUD d'outils** (`list_tools`, `create/update/delete_toolbox`) avec validation stricte, **API REST** (built-ins read-only), **domaines** (26 intégrés + custom), **ciblage par source**, **délégation scout** (cheap model + toolbox read-only), **sub-Kin hard floor** (`HARD_EXCLUDED_FROM_SUBKIN` après allow-list), **éditeur UI réactif**.

**Les prouesses techniques.** Resolver unifié 4 sources sans gates par-Kin ; wildcard stratégique ; résolution runtime ; hard floor sub-Kin filtré après allow-list (un `all` ne peut pas smuggler les outils main-session) ; scout chain (override → Kin → projet → global → modèle Kin) ; assignment surfaces multiples ; domaines avec color tokens.

**Wow factor : 4/5.**

---

### 11. Transparence contexte & tokens

**Le pitch.** Transparence complète et auditée des tokens : visualisation détaillée du contexte, estimation précise des coûts, monitoring live du cache Anthropic.

**Ce que c'est.** Système multi-couches : estimation par section (BPE), visualisation interactive, breakdown par source, observabilité du cache Anthropic (hit rate + TTL), calibration auto per-Kin (EMA), tracking exhaustif de chaque appel, masquage des contenus sensibles avant summarization, troncature d'historique par budget token.

**Les capacités clés.**
- **Context Viewer** : barre stacked multi-couleur (système/résumés/cron/apprentissages/messages/outils) + tableau détaillé + breakdown des sections système (`ContextViewerDialog.tsx`).
- **Estimation granulaire par section** (`ContextTokenBreakdown` : systemPrompt, messages, tools, summary, cronRuns, cronLearnings).
- **Observabilité cache Anthropic** : cacheRead/Write/fresh tokens, hitRate %, TTL résiduel, états warm/cooling/cold/expired, breakpoints BP1-4, volatile en `<system-reminder>` après le préfixe (`llm-cache-hints.ts`).
- **Calibration auto per-Kin (EMA)** : compare factuel vs BPE, factor borné [1.0, 1.6] persisté (`recordApiContextSize`).
- **Historique des appels** (table `llm_usage` : callSite, model, kinId/taskId/cronId, cache tokens, stepCount), **deux barres** (local estimate vs provider ground-truth), **masquage des tool results >500c** avant summarization, **smart history trimming** (budget 40k tokens vs hard message limit), **breakdown système par `##`**, **context preview** per-Kin/task/session, **roll-up tokens par task**.

**Les prouesses techniques.** Calibration deux-étages (BPE local + feedback provider en boucle fermée EMA) ; stratégie cache multi-breakpoint ; heuristiques média (images bytes/750, PDFs bytes/3000×500) ; trimming par budget token ; masquage transparent ; provenance à 3 niveaux ; fire-and-forget `recordUsage`.

**Wow factor : 5/5.** *(Creneau quasi vacant — aucun concurrent grand public n'expose le budget de tokens à ce niveau.)*

---

### 12. Channels & binding multi-Kin

**Le pitch.** Architecture omnicanale où plusieurs Kins partagent et transfèrent dynamiquement les canaux de communication en temps réel.

**Ce que c'est.** Système de messagerie reliant les Kins à 6 plateformes (Telegram, Discord, Slack, WhatsApp, Signal, Matrix), avec transfert dynamique de la propriété d'un canal d'un Kin à l'autre au runtime. Les adresses ne changent pas — c'est le Kin qui change. Le nouveau Kin reçoit le contexte du handoff et la chaîne de causalité.

**Les capacités clés.**
- **6 plateformes intégrées** avec adaptateurs dédiés (limites de caractères, auth, métadonnées) (`channels.ts:150-226`).
- **Transfert de canaux temps-réel** (`transfer_channel(channelId, targetKinSlug, reason?)` : mutation atomique, 2 messages d'audit, SSE, hint sideband 5 min).
- **Liaison Kin↔canal mutable**, **envoi inter-Kin** (emprunt sans mutation, préfixe `[NomKin]` auto si non-propriétaire, audit `channel_message_links.sentByKinId`).
- **Contexte de transfert** injecté dans `<channel-context>` (fromKin, reason, timestamp), **préfixage d'identité auto** (native/prefix/none), **rangées d'audit système**, **validation config + auth** (secrets auto-vaultés), **gestion des utilisateurs en attente** (pending → approval propagée par plateforme), **pièces jointes + vision**, **chaîne de causalité** (`channelOriginId` : livraison auto via le canal d'origine après sauts inter-Kins), **statuts de livraison async** (queued/sent/delivered/read/failed), **API REST + webhooks**.

**Les prouesses techniques.** Handoff = une mutation DB + orchestration mémoire ; chaîne de causalité via `channelOriginId` ; secrets vaultés (`channel_<platform>_<id>_<field>`) ; registry d'adaptateurs extensible (built-in + plugins identiques) ; localisation selon la langue du propriétaire du Kin ; préfixe idempotent.

**Wow factor : 4/5.** *(Égale l'omnicanal d'OpenClaw mais avec PWA multi-utilisateurs + transfert dynamique.)*

---

### 13. Vault & sécurité des secrets

**Le pitch.** Coffre-fort de secrets chiffré côté serveur, références de configuration, saisie sécurisée UI→serveur — jamais exposé au LLM.

**Ce que c'est.** Coffre (`vault_secrets`) où chaque secret est chiffré en AES-256-GCM. Les configs de providers/channels stockent des **références** (`$vault:<clé>`) résolues juste avant usage. Le LLM ne voit que des confirmations non sensibles. Redaction possible des messages contenant des secrets involontaires.

**Les capacités clés.**
- **Chiffrement AES-256-GCM** (IV aléatoire 12o + tag d'auth, clé 256-bit auto-générée chmod 0o600) (`encryption.ts`).
- **Saisie sécurisée UI→Vault** (`request_provider_setup`, `request_channel_setup`, `prompt_secret`) : créer + tester + stocker atomiquement sans retour au LLM (`secret-prompts.ts`).
- **Références de config** (clé déterministe `provider_<type>_<id>_<field>`, rotation en une ligne, hydratation juste-à-temps).
- **Redaction de messages** (`redact_message`, `redactPending` exclut du compacting — empêche les secrets de contaminer les résumés).
- **Typed Vault Entries** (credential/card/note/identity + types custom, champs typés), **recherche par métadonnées seulement** (jamais les valeurs), **pièces jointes chiffrées**, **statut/historique** (suppression limitée au créateur).

**Les prouesses techniques.** IV aléatoire par message ; clé résolue par priorité (env > fichier persistant > auto-généré) ; référence déterministe permettant les PATCH sans dupliquer ; hydratation au point d'usage ; filtrage DB du compacting pour `redactPending` ; suppression cascade.

**Wow factor : 4/5.** *(Argument de confiance que peu formalisent.)*

---

### 14. Système de mémoire

**Le pitch.** Moteur de mémoire durable, hybride (sémantique + texte), sans maintenance, avec extraction LLM automatique et rappel multi-requête.

**Ce que c'est.** Système SQLite-vectorisé de mémoire long terme. Deux canaux : capture automatique (extraction LLM pendant compaction) et outil explicite `memorize`. Recherche hybride sqlite-vec KNN + FTS5 fusionnée par Reciprocal Rank Fusion, ré-ordonnée par importance, décroissance temporelle, récence, pertinence catégorique. Consolidation auto des quasi-doublons, recalibration d'importance, élagage conservateur.

**Les capacités clés.**
- **Dual-channel capture** (automatic avec dédup KNN k=3 distance<0.15 ; explicit avec catégorie/importance/sujet/scope) (`memory.ts:16-35`).
- **Recherche hybride** : KNN cosine + FTS5 (AND→OR fallback), RRF (K=60, FTS boost 0.5), multi-query (3 variations) + HyDE optionnels (`:569-669`).
- **Ranking post-fusion** : 5 multiplicateurs (decay catégorie-aware, importance, log-retrieval boost clampé, subject boost 1.3, category intent 1.25 bilingue).
- **Re-ranking LLM + adaptive-K trimming** (min-score-ratio + largest-gap), **consolidation auto** (clusters similarité ≥0.85/0.95, merge LLM avec abort-si-différent, max 3, generation counter), **recalibration d'importance** (deltas ≤0.2 anti-feedback-loop), **élagage stale conservateur**, **embedding pluggable** (graceful degradation FTS-seul), **rewrite contextuel** des follow-ups, **scoped memories** (private/shared cross-Kin), **outils** (recall/memorize/update/forget/list/review), **intégration compaction lifecycle**, **retrieval tracking**.

**Les prouesses techniques.** Dual-virtual-table (memories_fts trigger-synced + memories_vec sqlite-vec) ; RRF K=60 ; decay configurable par catégorie + floor 0.7 ; extraction post-compaction JSON greedy + dédup KNN ; consolidation asymétrique ; recalibration anti-runaway ; query expansion multi-axes.

**Wow factor : 3/5.** *(Cœur mature et éprouvé ; quelques arêtes — voir limites.)*

---

### 15. Automatisation (crons, webhooks, tasks, human-in-the-loop, scout)

**Le pitch.** Système d'automatisation multi-volets orchestrant tâches planifiées, déclencheurs externes, approbations humaines et explorations déléguées à modèle scout.

**Ce que c'est.** Couche en strates : crons (POSIX ou ISO8601, one-shot inclus), webhooks (filtrage simple/regex + dispatch bimodal), human-in-the-loop (pause par tâche pour décision interactive), scout (délégation read-only à modèle cheap), le tout sur une gestion de tâches persistantes (queue globale, concurrence par groupe, snapshots gelés, SSE).

**Les capacités clés.**
- **Crons** (POSIX/ISO8601, sous-Kin async, approbation requise si créé par Kin, one-shot, `trigger_parent_turn`, toolboxes) (`crons.ts:52-134`).
- **Cron Learnings** (sauvegarde auto, dédup, rotation FIFO max 20, consulté au spawn pour auto-correction).
- **Webhooks** (token SHA256, filtrage simple dot-notation ou regex POSIX, dispatch conversation ou tâche, templates `{{field.path}}`, concurrence + rate-limiting, payloads 512KB).
- **Tâches enfants** (queue globale + groupes de concurrence, queueing libère le slot global, contexte gelé au spawn).
- **Human-in-the-loop** (`prompt_human` confirm/select/multi_select/text, badge `awaiting_human_input`, re-injection auto, anti-runaway expired, un par turn).
- **Scout** (délégation read-only digest, chain override→Kin→projet→global→Kin, toolbox scout LEAF), **wakeup scheduler** inter-Kin persisté, **approbation des crons Kin**, **snapshot gelé** (cache Anthropic warm), **SSE**, **toolboxes per-task** (+ hard floor), **modèles per-task/projet/Kin**.

**Les prouesses techniques.** Scheduler in-process Croner ; gates atomiques via UPDATEs conditionnels SQLite (race-winner) ; concurrence deux-tiers (slots globaux vs ACTIVE par groupe) ; snapshot `TaskPromptContextSnapshot` byte-identical ; filtrage webhook simple + regex ; résolution templates au trigger ; queuing par groupe (`promoteGlobalQueue`) ; late-response guard ; learnings dédup+rotation.

**Wow factor : 3/5.**

---

### 16. Plateforme & power-user (MCP, logs, SQL, contacts, fichiers, multi-user)

**Le pitch.** Plateforme multi-utilisateur avec serveurs MCP dynamiques, audit des logs, requêtes SQL directes, contacts centralisés, stockage de fichiers partageables et sessions privées éphémères.

**Ce que c'est.** Pile complète pour power-users/admins : MCP ajoutables dynamiquement par les Kins (auto-assignment, approval, discovery), logs système temps-réel filtrable, SQL direct pour debug, config plateforme avec redaction des secrets, contacts centralisés à notes scopées, fichiers shareable (public/privé/password/burn), quick-sessions privées par utilisateur.

**Les capacités clés.**
- **Serveurs MCP dynamiques** (`add_mcp_server`, auto-assignment, statut actif/pending, reconnexion auto, timeouts 30s/120s, noms canoniques `mcp_<server>_<tool>`) (`mcp.ts:184-300`).
- **Logs système temps-réel** (ring buffer 2000, filtres level/module/texte/temps, SSE) (`log-store.ts`).
- **Requêtes SQL** (lecture/écriture auto-détectée, params liés, limite 500 lignes, opt-in).
- **Config plateforme** (`get_platform_config` secrets redactés, `updatePlatformConfig` .env guidé, `restartPlatform`).
- **Contacts centralisés** (firstName/lastName, nicknames, identifiers, notes private/global/user) (`contacts.ts`), **fichiers partageables** (public/password/expiration/burn, URLs token), **quick-sessions** (isolation `createdBy`, expiration auto, cleanup, sauvegarde en mémoire), **notifications multi-canal** (préférences par type, livraison externe), **résolveur de fournisseurs pluggable** (un config, capacités auto-détectées), **outils système** (CPU/RAM/disk/Docker, opt-in).

**Les prouesses techniques.** Pool de connexion MCP (JSON Schema→Zod, sanitization de noms) ; isolation multi-utilisateur (createdBy + notes scopées + SSE) ; ring buffer in-memory ; parsing .env.example avec métadata + SENSITIVE_KEYS ; cleanup jobs périodiques ; pattern Registry par famille.

**Wow factor : 4/5.**

---

## Top features héros (classement transversal par wow factor)

Les items les plus marquants à mettre en avant, par ordre d'impact :

1. **🏆 UI/UX, PWA & Design System (5/5)** — 18 palettes Aurora OKLch, contraste adaptatif WCAG AA, PWA native, glass morphism niveau Linear/Stripe. La crédibilité visuelle qui crée la confiance.
2. **🏆 Onboarding conversationnel Sherpa (5/5)** — un Kin configurateur qui installe tout par conversation, zéro CLI/YAML, secrets jamais au LLM. **Le différenciateur d'adoption grand public unique sur le marché self-hosted.**
3. **🏆 Transparence contexte & tokens (5/5)** — double barre estimate/ground-truth, observabilité cache Anthropic live, calibration EMA per-Kin. **Creneau quasi vacant chez tous les concurrents.**
4. **Architecture & runtime des Kins (4/5)** — session continue, mémoire hybride, queue FIFO, sous-Kins await/async, inter-Kin messaging, browser stateful. Le socle qui rend le reste possible.
5. **Channels & binding multi-Kin (4/5)** — omnicanal 6 plateformes + **transfert dynamique de canal entre Kins en temps réel** + chaîne de causalité. Égale OpenClaw, le dépasse en UX.
6. **Mini-apps intégrées (4/5)** — les Kins construisent de vraies apps web themées (SDK + 24 hooks + 50+ composants + backend). Au-delà des « artifacts ».
7. **Outils personnalisés + renderers riches (4/5)** — outils multi-langage + UI React validée bi-phase. Vos outils ressemblent aux natifs.
8. **Avatars auto-générés (4/5)** — identité visuelle par Kin via 3 axes + base neutre cohérente. Touche grand public.
9. **Vault & sécurité des secrets (4/5)** — AES-256-GCM, références, saisie sécurisée jamais au LLM, redaction bloquant le compacting.
10. **Plugins, SDK & marketplace (4/5)** — NPM décentralisé, SDK lean, 9 fournisseurs natifs, 100 % self-hosted sans cloud propriétaire.

---

## Différenciateurs transversaux

Les thèmes récurrents qui définissent l'identité de KinBot, traversant tous les domaines :

### Transparence radicale
Présente dans le **contexte/tokens** (double barre estimate vs ground-truth, breakdown par section, cache live), le **compacting** (résume sans jamais supprimer les originaux), la **mémoire** (retrieval tracking, importance scoring visible), les **tasks** (roll-up tokens par job), les **plugins** (permissions explicites runtime), les **channels** (audit immuable). Rien n'est caché à l'utilisateur — il peut comprendre et maîtriser ses coûts et ses limites.

### Confidentialité & coffre-fort
Le **vault AES-256-GCM** dont les secrets ne sont jamais injectés dans le prompt (seulement `get_secret`), la **saisie sécurisée UI→serveur** (Sherpa, channels, providers), la **redaction** bloquant le compacting, les **comptes connectés** (tokens chiffrés, jamais vus par les Kins), les **quick-sessions** isolées par utilisateur, les **contacts read-only externes** non copiés. Souveraineté des données par construction.

### Extensibilité
**Custom tools** any-language, **plugins NPM + SDK**, **serveurs MCP** dynamiques, **mini-apps**, **fournisseurs pluggables** (un config, N capacités auto-détectées), **hooks lifecycle**, **toolboxes** composables, **avatars custom**. Les Kins peuvent invoquer n'importe quel code et étendre la plateforme eux-mêmes.

### Polish
Le **design system** (18 palettes, WCAG AA, 21 micro-interactions), les **renderers riches** (custom + natifs themés), les **avatars** générés, la **PWA**, l'**i18n 4 langues**. Une qualité perçue d'assistant grand public, pas de « web app dans une webview ».

### Self-hosting souverain
**Un process, une base SQLite, un conteneur, zéro infra externe**. Pas de Postgres/Redis/Mongo/SearxNG (contrairement à Dify, Khoj, LobeHub, LibreChat). Déploiement en 30 secondes, upgrade = re-pull l'image, zéro lock-in. Le **marketplace de plugins reste décentralisé via npm** (vs cloud propriétaire de LobeHub).

### Setup conversationnel
**Sherpa** rend le self-hosted accessible aux non-techniciens : pas de YAML, pas de docker-compose, pas de CLI. Un Kin configurateur guide l'installation, branche les providers, gère les secrets et personnalise l'apparence par conversation — et reste accessible à vie. Aucun concurrent self-hosted n'a d'équivalent.

### Collaboration & orchestration d'agents (bonus)
La métaphore d'**équipe de Kins** : session continue unique, inter-Kin messaging (request/reply à correlation IDs, rate-limited), sous-Kins éphémères (await/async), crons/webhooks/human-in-the-loop, transfert dynamique de channels. Positionnement quasi vacant côté self-hosted.

---

## Honnêteté : limites & rough edges

À garder en tête pour ne pas sur-vendre. KinBot 1.0 est **production-ready pour un usage individu / petite équipe**, avec des fondations solides et un polish UX en cours.

### Maturité globale par domaine
- **Solide / production-ready** : runtime core (queue, streaming, tool execution), compacting, mémoire (cœur), inter-Kin, sous-Kins, prompt builder + cache, custom tools, MCP, UI/design system (1289 tests passants), mini-apps (cœur), comptes connectés (e2e), vault, transparence tokens, channels, plateforme power-user, toolboxes.
- **Stable mais plus récent** : scout (2025, chain rationalisée récemment), hooks lifecycle plugins (design stabilisé), enrichment agent (moins testé que le CRUD core).
- **Partiellement implémenté / prompt-dependent** : la modale OnboardingChatModal de Sherpa, sa posture « data-driven » (dépend du prompt-tuning, peut être verbeux ou trop timide).

### Rough edges concrets
- **Architecture** : résolution HITL captcha browser **manuelle** (screenshot + continue) ; merge télescopique potentiellement agressif sur très vieilles summaries (rare) ; depth max sous-Kins fixée à 3 ; thinking blocks Anthropic pas encore auto-injectés par le prompt builder ; vision multimodale non héritée nativement par les sous-Kins ; `concurrency_group/max` : colonnes DB présentes, logique runtime manquante.
- **UI/PWA** : glass morphism backdrop-filter coûteux sur Android mid-range (pas de fallback `prefers-reduced-transparency`) ; ~600 lignes de CSS dupliquées pour le soft contrast (dette de maintenabilité) ; SW hand-coded moins robuste que Workbox (cleanup cache manuel) ; certains labels deep-feature peuvent fallback EN ; pas d'audit a11y tiers ; navigateurs modernes only.
- **Mini-apps** : backend `_server.js` mono-fichier (routing en if/else) ; composants pas pleinement WCAG-AA (ARIA souvent absent) ; `share()` = copie JSON one-shot sans binding réactif ; console buffer à interroger manuellement ; chat template pas two-way sans polling.
- **Sherpa** : ne peut **pas supprimer** de Kins (sécurité délibérée), pas uploader d'avatar custom (UI-only), pas accéder au vault directement ; onboarding réservé au premier admin ; tests secure-input à étendre ; race conditions multi-device sur `secret_prompts` à traiter.
- **Avatars** : qualité dégradée si LLM prompt-writer indisponible (fallback générique) ; échec de génération silencieux (pas d'avatar, Kin reste opérationnel) ; edit mode coûteux en tokens.
- **Projets** : kanban mobile basique (single-column) ; recherche tickets non-FTS5 (titre/numéro brut) ; pas de planning/sprints/dépendances ni de vues list/gantt/calendar ; pas de permissions granulaires (single-tenant) ; pas de webhooks entrants pour les tickets ; mentions `#N` dans les commentaires pas encore auto-linkifiées.
- **Comptes connectés** (post-v1) : threading IMAP + dossier Sent auto ; écriture d'invitations CalDAV (read-only) ; normalisation E.164 ; polling inbound asynchrone (pas de push — les Kins ne voient les emails que sur interrogation) ; présets CalDAV.
- **Plugins** : **pas de sandboxing VM** (trust model : source npm ou git admin-approved) ; pas de semver resolution (topo-sort seul) ; pas de rate-limiting/quota par plugin ; enrichissement marketplace best-effort (timeout 3s).
- **Toolboxes** : domaines custom peu documentés ; pas de bulk operations / templates ; hard floor sub-Kin solide mais peu visible (risque d'incompréhension) ; pattern scout sous-documenté.
- **Transparence tokens** : `ContextTokenBreakdown` ne split pas dynamiquement les sections cron (hard-coded tasks) ; chip de calibration affiché seulement si drift >10 % ; quelques typos FR/EN.
- **Channels** : hint de transfert sideband **perdu au redémarrage** (par conception) ; channel origins encore immatures (cross-delivery rare) ; tous les adaptateurs plugin n'implémentent pas `onIdentityChange` (fallback préfixe).
- **Vault** : pas d'audit trail public des accès (debug logs seulement) ; pas de rotation de la clé maître ; pas de multi-clé / HSM (cohérent avec single-binary).
- **Mémoire** : `memories_vec` sync **manuel** (pas trigger-synced → risque de desync sur writes DB directs) ; setter `redactPending=true` manquant (scaffold async) ; bloc contacts/notes **non borné** en tokens → inflation du prompt sur contacts volumineux ; extraction JSON greedy regex (pas streaming-safe) ; `maxGen` consolidation hard-codé à 5.
- **Automation** : Kins ne peuvent pas créer leurs propres crons par défaut sans setup (UI approval pas finalisée 1.0) ; config UI scout per-Kin/projet minimaliste ; rotation learnings à 20 non configurable (perte d'insights anciens) ; payloads webhook >512KB tronqués (pas de streaming) ; bottleneck possible si `maxConcurrentTasks` trop bas ; dépendance forte au SSE (latence accrue sans).
- **Plateforme power-user** : approval MCP optionnel (dépend de la config) ; cleanup auto périodique (délai avant suppression réelle des quick-sessions/notifications).

### Recommandations post-1.0 prioritaires
1. Profiler le glass morphism sur Android + fallback transparency.
2. Générer le CSS soft-contrast (réduire la duplication).
3. Migrer le SW vers Workbox.
4. Audit a11y tiers.
5. Mémoire : passer `memories_vec` en trigger-sync, borner le bloc contacts/notes par budget token, implémenter le setter `redactPending` si la redaction async est planifiée.
6. Finaliser l'UI d'approbation des crons Kin et la modale d'onboarding Sherpa.

---

*Fin du catalogue. Document maintenu en sync avec `idea.md`, `schema.md`, `api.md`, `sse.md`, `prompt-system.md`, `compacting.md`, `sherpa.md` et le code source.*