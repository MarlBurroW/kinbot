# Stratégie de communication & positionnement — KinBot 1.0 (premier jet)

> **Statut : brouillon de travail, à challenger avec le fondateur.** Ce document est opinioné par construction : il propose des choix tranchés pour amorcer la discussion, pas pour la clore. Les zones grises sont signalées en *Questions ouvertes* (section 9) et par des notes inline `[À TRANCHER]`.

---

## 1. Positionnement — la "big idea"

### Phrase de positionnement (recommandée)

> **KinBot, c'est votre propre équipe d'agents IA — qui se souviennent, collaborent et vous répondent partout — installée sur votre serveur en un seul conteneur.**

L'idée centrale repose sur quatre mots porteurs, dans cet ordre de force : **équipe d'agents persistants** (pas un chatbot) + **mémoire** (qui se souviennent) + **omnicanal** (partout) + **souveraineté/simplicité** (votre serveur, un conteneur).

Pourquoi cet angle plutôt qu'un autre : la veille montre que **personne ne réunit aujourd'hui dans un seul conteneur** une UX grand public + des agents persistants collaboratifs + l'omnicanal natif + un onboarding conversationnel. Le concurrent le plus proche (OpenClaw) fait l'omnicanal mais en CLI mono-user. Les UI de chat (LibreChat, Open WebUI) sont restées dans le paradigme "conversations". C'est précisément l'intersection vide qu'il faut occuper.

### Variantes de tagline

1. **"Votre équipe d'IA, chez vous."** — courte, mémorable, porte la métaphore d'équipe + souveraineté. Ma préférée pour le hero.
2. **"La simplicité de ChatGPT. La souveraineté de votre serveur."** — explicite le gap de marché identifié dans la veille ("posséder la simplicité de ChatGPT/Poe, en self-hosted"). Excellente pour la cible "grand public prudent".
3. **"Des agents qui se souviennent, collaborent, et ne quittent jamais votre serveur."** — plus dense, met en avant mémoire + collaboration + privacy. Bonne pour une audience tech/privacy.

`[À TRANCHER]` Le mot "Kin" est central dans le produit mais opaque pour un nouveau visiteur. Faut-il l'introduire dès la tagline, ou d'abord parler d'"agents" puis révéler "Kins" ? Je penche pour : **"agents" en surface marketing, "Kins" comme terme propriétaire révélé juste après** (effet de marque sans friction de compréhension).

---

## 2. Audiences cibles (classées)

Classement par **facilité d'acquisition × adéquation produit** pour un lancement 1.0. La maturité du produit (~80%, "recommandé pour early adopters avec patience pour l'itération UX") oriente vers des cibles tolérantes mais exigeantes.

### #1 — Power-users self-hosting (cœur de cible 1.0)
Les gens qui font déjà tourner Jellyfin, Nextcloud, Home Assistant sur un homelab/VPS. Ils cherchent le prochain "must-self-host".
- **Message qui résonne :** *"Un seul `docker run`. Zéro Postgres, Redis, Mongo ou S3. Une équipe d'agents qui se souviennent, branchés à vos messageries, sur votre matériel."*
- **Pourquoi eux d'abord :** la veille hammer le point "un seul conteneur, zéro infra externe" comme différenciateur radical vs Dify/Khoj/LobeHub/LibreChat. C'est *leur* langage. Et ils pardonnent les arêtes UX si la valeur est là.

### #2 — Devs / tinkerers / intégrateurs
Ceux qui veulent étendre, scripter, brancher leurs propres outils et APIs.
- **Message qui résonne :** *"Custom tools dans n'importe quel langage avec rendu React riche. Plugins NPM via SDK typé. MCP natif. Mini-apps construites par l'agent. Tout extensible, rien verrouillé."*
- **Pourquoi eux :** ce sont les évangélistes. Ils écrivent les plugins du marketplace, les blog posts, les "I built X with KinBot". L'extensibilité (custom tools + mini-apps + plugins) est faite pour eux.

### #3 — Privacy-conscious / souveraineté-first
Individus et petites structures qui refusent le cloud fermé par principe (RGPD, données sensibles, méfiance).
- **Message qui résonne :** *"Vos secrets ne sont jamais envoyés au LLM. Vos emails ne quittent pas votre serveur. Vos conversations ne sont jamais supprimées ni exfiltrées. Coffre-fort AES-256-GCM, multi-provider, 100% self-hosted."*
- **Pourquoi eux :** le vault "jamais exposé au LLM" et les comptes connectés "qui restent dans votre infra" sont des arguments de confiance que **personne ne formalise** (gap de la veille).

### #4 — Petites équipes & familles (cible d'expansion, post-1.0)
2-10 personnes partageant des agents communs.
- **Message qui résonne :** *"Une session continue partagée : tout le monde parle aux mêmes Kins, qui connaissent votre contexte, répondent dans la langue de chacun, et se passent le relais entre eux."*
- **Pourquoi plus tard :** le multi-user fonctionne (isolation stricte testée) mais le "wow" collaboratif demande de mûrir l'UX et le storytelling. À pousser une fois les early adopters convertis. **Ne pas en faire le pitch d'ouverture du site 1.0** — risque de diluer le message.

`[À TRANCHER]` Le fondateur vise "individus et petits groupes". Mon classement met les petites équipes en #4, pas #1, **délibérément** : acquérir un homelabber solo est 10× plus facile que convaincre une équipe d'adopter un outil self-hosted en early access. La famille/équipe est la *vision*, le power-user solo est le *go-to-market*. À valider.

---

## 3. Piliers de message (challenge de l'ordre du fondateur)

### Le fondateur propose comme axes #1 :
UI tout-en-un polie/PWA · extensibilité (custom tools + mini-apps + plugins) · onboarding Sherpa · avatars.

### Mon verdict : **réordonner.** Voici pourquoi.

Les `wow_factor` des dossiers et la veille concurrentielle ne pointent pas tous dans la même direction. Trois remarques avant le classement :

- **L'UI/PWA (wow 5) est superbe MAIS ce n'est pas un différenciateur défendable.** Open WebUI et Lobe Chat ont aussi une UX très polie. La veille le dit : sur l'axe "UI soignée" vous êtes excellents mais en concurrence frontale. Une belle UI est une **condition d'entrée**, pas une *raison d'être*. Elle doit servir de preuve, pas de pilier #1.
- **Les avatars (wow 4) sont une touche grand public réelle et absente des concurrents** — mais c'est un *charmeur*, pas un *décideur d'achat*. Personne ne migre son infra pour des avatars. À garder comme pilier secondaire / preuve d'attention au détail.
- **Ce qui est vraiment vacant sur le marché**, d'après la veille : agents persistants collaboratifs en session continue, omnicanal+web ensemble, secrets jamais-au-LLM, onboarding conversationnel, un seul conteneur. **C'est là que doivent être les piliers #1-2.**

### Classement recommandé

| # | Pilier | Promesse | Preuves (features) | Audience |
|---|---|---|---|---|
| **1** | **Une équipe d'agents persistants qui collaborent et se souviennent** | "Pas un chatbot qui oublie. Une équipe qui accumule du contexte sur des mois, se passe le travail entre agents, et vous connaît vraiment." | Session continue unique (pas de "nouvelle conversation") · mémoire hybride sémantique+FTS · sous-Kins await/async · inter-Kin request/reply · compacting sans suppression · registre de contacts partagé | Power-users, petites équipes, privacy-conscious |
| **2** | **Tout self-hosted, un seul conteneur, zéro lock-in** | "Un `docker run`. Zéro infra externe. Vos données, vos clés, votre serveur." | Monoprocess Bun + SQLite · zéro Postgres/Redis/Mongo/S3 · multi-provider · vault secrets jamais exposé au LLM · comptes connectés (mail/cal/contacts) qui restent locaux | Power-users self-hosting, privacy-conscious |
| **3** | **Extensible à l'infini, sans rien verrouiller** | "Des outils custom dans n'importe quel langage, avec UI riche. Des mini-apps construites par vos agents. Des plugins NPM. MCP natif." | Custom tools multi-langage + renderers React themés · mini-apps intégrées (SDK + 50 composants) · plugins NPM via SDK typé + marketplace · MCP dynamique · toolboxes (scoping fin) | Devs/tinkerers, intégrateurs |
| **4** | **Vos agents, partout — pas seulement dans une app** | "Telegram, WhatsApp, Slack, Discord, Signal, Matrix — plus une PWA polie. Un Kin peut passer le canal à un spécialiste en temps réel." | 6 plateformes natives · transfert de canal dynamique entre Kins · PWA installable · livraison causal-chain | Power-users, petites équipes, mobiles |
| **5** | **Setup conversationnel, zéro YAML (Sherpa)** | "Pas de fichier de config. Un agent vous guide : il branche vos providers, gère vos secrets en sécurité, crée vos premiers agents — par conversation." | Onboarding Sherpa (3 écrans → chat) · secure input (secrets jamais au LLM) · reste accessible à vie · avatars personnalisables | Non-techniques, grand public prudent |

### Où je confirme le fondateur, où je diverge

- **Sherpa : confirmé comme différenciateur fort, mais pas en #1.** C'est un *gap d'adoption majeur* selon la veille (aucun self-hosted n'a ça) et son `wow_factor` est 5. MAIS : c'est un argument qui se *montre* (démo, GIF) plus qu'il ne se *vend* en headline. On n'achète pas un produit "parce que l'onboarding est sympa" — on l'achète pour ce qu'il fait, puis on est *ravi* que l'onboarding soit indolore. Sherpa est donc un pilier #5 en hiérarchie de message, mais une **feature héros #1 en termes de démo** (cf. section 5). C'est une nuance importante : *priorité de pitch ≠ priorité de showcase.*
- **Extensibilité : confirmée en top-tier (#3), c'est solide.** Custom tools à rendu riche + mini-apps sont vraiment inédits dans le self-hosted (gap veille). Bon instinct du fondateur.
- **UI/PWA : rétrogradée de #1 à statut de preuve transversale.** Elle infuse tous les piliers (c'est *grâce à* l'UI polie que Sherpa, les mini-apps, les avatars brillent) mais n'est pas un pilier autonome défendable.
- **Avatars : rétrogradés à "charmeur" / preuve, pas pilier.** Mignon, mémorable, différenciant à la marge — mais pas un axe de vente principal.

`[À TRANCHER]` Mon pilier #1 ("équipe persistante qui se souvient") parie que la **mémoire + collaboration** est le vrai différenciateur durable, en phase avec la tendance de fond de la veille ("la demande se déplace de la génération de code vers la mémoire persistante et l'automatisation ambiante"). Le fondateur doit valider ce pari narratif : vend-on d'abord *le polish* (UI/Sherpa/avatars) ou *la substance* (mémoire/agents/souveraineté) ? Je recommande fortement la substance, avec le polish comme preuve.

---

## 4. Tableau comparatif (synthèse de la veille)

Dimensions choisies = celles où KinBot gagne ou se différencie, croisées avec ce qui compte pour les cibles.

| Dimension | KinBot | LibreChat | Open WebUI | AnythingLLM | Lobe Chat | Dify | OpenClaw | ChatGPT/Claude |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Self-hosted souverain | ✅ | ✅ | ✅ | ✅ | ⚠️ cloud market | ✅ | ✅ | ❌ |
| Déploiement 1 conteneur, zéro infra externe | ✅ | ❌ Mongo | ⚠️ | ✅ | ❌ PG+Redis+S3 | ❌ lourd | ⚠️ daemon | n/a |
| Agents à identité/mémoire persistante | ✅ | ⚠️ | ❌ | ⚠️ workspace | ⚠️ | ❌ | ⚠️ GPTs |
| Session continue unique (pas de "new chat") | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Collaboration inter-agents + sous-agents | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ workflow | ⚠️ | ❌ |
| Mémoire hybride sémantique+FTS | ✅ | ⚠️ KV | ⚠️ RAG | ⚠️ RAG | ⚠️ | ✅ RAG | ❌ | ⚠️ |
| Omnicanal natif (Telegram/WhatsApp/Slack/Signal…) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ 25+ | ❌ |
| UX grand public / PWA polie | ✅ | ✅ | ✅ app native | ✅ | ✅ | ❌ builder | ❌ CLI | ✅ |
| Onboarding conversationnel (zéro YAML) | ✅ Sherpa | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ CLI onboard | n/a |
| Custom tools à rendu riche + mini-apps | ✅ | ⚠️ artifacts | ⚠️ functions | ⚠️ skills | ⚠️ plugins | ⚠️ | ⚠️ canvas | ⚠️ |
| Plugins NPM + SDK, sans cloud proprio | ✅ | ⚠️ | ⚠️ | ✅ MIT | ❌ cloud market | ✅ | ⚠️ ClawHub | ❌ |
| Vault secrets jamais exposé au LLM | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | n/a |
| Transparence tokens/contexte fine | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ debug | ❌ | ❌ |
| Crons + webhooks + human-in-the-loop intégrés | ✅ | ❌ | ❌ | ⚠️ | ❌ | ✅ | ⚠️ cron | ❌ |

Légende : ✅ fort/natif · ⚠️ partiel/custom/dépendances · ❌ absent.

**Lecture du tableau :** les lignes où KinBot est seul en ✅ (session continue, inter-agents, vault jamais-au-LLM, transparence tokens, onboarding conversationnel) sont les **angles d'attaque à marteler**. La colonne OpenClaw est le vrai rival sur l'omnicanal — d'où l'importance de différencier sur "PWA polie multi-user vs CLI mono-user".

`[À TRANCHER]` Hermes Agent et QwenPaw sont cités comme "nouveaux entrants rapides sur mémoire long-terme et multi-canal" mais sans dossier détaillé. À surveiller — peuvent menacer le pilier #1. Faut-il les inclure dans le tableau public ou les garder en veille interne ? (Je recommande veille interne : ne pas faire de pub à des challengers émergents.)

---

## 5. Features héros pour le site (sections dédiées avec visuel)

8 features méritent leur propre section. Ordre = ordre d'apparition recommandé sur la home (après le hero). **Note : l'ordre de showcase diffère de l'ordre des piliers** — on ouvre avec ce qui se *démontre* le mieux.

1. **L'équipe de Kins en action (collaboration inter-agents)**
   *Démo :* GIF — un Kin "Recherche" envoie un `request` à un Kin "Rédaction", qui produit le texte, sans intervention humaine entre les deux. Badges de queue visibles, avatars distincts.
   *Pourquoi héros :* incarne le pilier #1, impossible à montrer chez les concurrents.

2. **Sherpa : votre setup en conversation**
   *Démo :* GIF/vidéo — fresh install → 3 écrans rapides → Sherpa salue, demande une clé via popup sécurisée (le secret n'apparaît JAMAIS dans le chat), teste le provider, propose un premier Kin. ~30s.
   *Pourquoi héros :* le plus fort effet "wow, je peux faire ça sans terminal".

3. **Une mémoire qui ne s'efface pas**
   *Démo :* split — scroll dans un historique de 3 mois ; `recall("décision budget")` retrouve à la fois "600€" (FTS exact) et "combien pour les courses" (sémantique). Montrer que rien n'est supprimé.
   *Pourquoi héros :* la promesse émotionnelle ("il me connaît") + preuve technique.

4. **Vos agents, partout (omnicanal + transfert de canal)**
   *Démo :* un user écrit sur Telegram "parle-moi crypto" → le Kin généraliste appelle `transfer_channel` → le badge change en direct, le spécialiste reprend avec le contexte du handoff. Montrer la grille des 6 logos plateformes.
   *Pourquoi héros :* différencie directement vs OpenClaw (mêmes canaux, mais ici avec web polie + transfert temps réel).

5. **Des outils custom avec une vraie UI (renderers riches)**
   *Démo :* créer un tool météo Python en live → ajouter un `renderer.tsx` → résultat affiché en carte themée au lieu de JSON brut. Avant/après.
   *Pourquoi héros :* inédit dans le self-hosted, parle aux devs.

6. **Des mini-apps construites par vos Kins**
   *Démo :* `create_mini_app` template dashboard → 50+ composants rendus, dark mode toggle côté parent → re-render instantané. Puis "Improve this" : suggestion en langage naturel → le Kin édite → reload.
   *Pourquoi héros :* le saut au-delà des "artifacts", très visuel.

7. **Vos secrets ne voient jamais le LLM**
   *Démo :* inspect Network — le POST du secret va UI→serveur→vault chiffré ; la réponse au LLM ne contient qu'un "valid=true". Schéma vault AES-256-GCM.
   *Pourquoi héros :* argument de confiance unique, parle aux privacy-conscious.

8. **Zéro surprise de coûts (transparence tokens/contexte)**
   *Démo :* le Context Viewer — barre stacked multicolore (système/mémoires/messages/outils), breakdown par section, panel cache Anthropic (hit rate, TTL), calibration EMA per-Kin.
   *Pourquoi héros :* personne grand public n'expose ça ; rassure les budget-conscious.

**Sections "preuve" plus légères (pas pleine largeur, mais présentes) :** avatars auto-générés (galerie de 6 Kins), 18 palettes (palette switcher live), projets/Kanban + GitHub worktrees, crons/webhooks/human-in-the-loop, comptes connectés (mail/cal), PWA installable.

`[À TRANCHER]` 8 sections héros = home longue. Acceptable pour un produit riche (les sites self-hosted assument la longueur), mais à valider : préfère-t-on une home courte (3-4 héros) + une page "/features" exhaustive ? Je penche pour **home moyenne (5 héros : 1,2,3,4,7) + page features complète**.

---

## 6. Arborescence du site (GitHub Pages)

```
/                       Home — hero + 5 sections héros + comparatif condensé + CTA quickstart
/features               Toutes les capacités, regroupées par pilier (agents · self-host · extensibilité · omnicanal · onboarding)
  /features/agents          Kins, mémoire, sous-Kins, collaboration, session continue
  /features/extensibility   Custom tools, mini-apps, plugins/SDK, MCP, toolboxes
  /features/channels        Omnicanal, transfert de canal, PWA
  /features/automation      Crons, webhooks, human-in-the-loop, scout
  /features/security        Vault, comptes connectés, transparence tokens, multi-user
/why-kinbot             Comparatif détaillé vs alternatives + tableau des gaps de marché
/docs                   → renvoie vers la doc (Starlight)
/showcase               Galerie de mini-apps, custom tools communautaires, captures
/quickstart             docker run, prérequis, première connexion, lien Sherpa
/roadmap                Transparence sur la maturité (~80%) et le post-1.0
/blog (ou /changelog)   Annonces, deep-dives techniques, releases
/community              Discord/Matrix, contribuer, plugins tiers
```

Navigation principale réduite : **Features · Why KinBot · Docs · Quickstart · GitHub**. Le reste en footer.

`[À TRANCHER]` `/roadmap` qui assume publiquement la maturité ~80% : honnêteté radicale (cohérente avec la cible early-adopter et le pilier transparence) ou risque de faire fuir ? Je recommande de l'assumer — les self-hosters respectent l'honnêteté et c'est aligné avec l'ADN "transparence".

---

## 7. Angle du README / repo

Structure recommandée du haut de README :

1. **Logo + tagline** : "Votre équipe d'IA, chez vous." + une ligne : *"Une plateforme self-hosted d'agents IA persistants qui se souviennent, collaborent et vous répondent partout — en un seul conteneur."*

2. **Badges** : licence `[À TRANCHER]` · version/release · build/CI · Docker pulls · stars · Discord · "made with Bun".

3. **Hook visuel** : un GIF unique en haut (le plus fort = Sherpa onboarding OU collaboration inter-Kin). Un seul, qui claque.

4. **Pitch 30 secondes** (3-4 puces, pas un paragraphe) :
   - 🧠 **Des agents qui se souviennent** — session continue, mémoire hybride, jamais de reset.
   - 🤝 **Une équipe, pas un chatbot** — vos Kins collaborent et spawnent des sous-agents.
   - 📱 **Partout** — Telegram, WhatsApp, Slack, Discord, Signal, Matrix + PWA.
   - 📦 **Un seul conteneur** — zéro Postgres/Redis/Mongo. `docker run` et c'est parti.
   - 🔒 **Vos secrets restent à vous** — vault chiffré jamais exposé au LLM.

5. **Quickstart** immédiatement après — le `docker run` complet, copiable, puis "ouvrez votre navigateur, Sherpa s'occupe du reste." Insister sur l'absence d'étape de config manuelle.

6. **Capture d'écran** de l'UI (chat + sidebar Kins) sous le quickstart.

7. Puis : Features (liens vers site/docs) · Comparatif condensé · Architecture en une image · Contribuer · Licence.

**Ton du README :** confiant, concret, orienté "ce que tu peux faire en 2 minutes". Éviter le jargon interne (Kin/sous-Kin) dans les 3 premières lignes — l'introduire juste après le hook.

---

## 8. Structure de la doc

Doc technique (Starlight, déjà partiellement en place d'après les dossiers). Grandes sections :

```
Getting Started     Install (Docker/manuel) · Premier lancement · Sherpa · Concepts clés (Kin, session, mémoire)
Core Concepts       Kins & identité · Session continue & compacting · Mémoire · Queue & priorité · Contacts
Working with Kins   Créer/configurer · Toolboxes · Avatars · Modèles & providers
Collaboration       Sous-Kins (await/async) · Inter-Kin messaging · Crons · Webhooks · Human-in-the-loop
Channels            Connecter Telegram/WhatsApp/Slack/Discord/Signal/Matrix · Transfert de canal · PWA
Extending KinBot    Custom tools (+ renderers) · Mini-apps (SDK, hooks, composants) · Plugins (SDK, publication NPM) · MCP
Projects            Projets · Kanban/tickets · Intégration GitHub
Connected Accounts  Mail · Calendrier · Contacts · OAuth & IMAP/CalDAV
Security & Privacy  Vault · Comptes connectés · Multi-user/isolation · Redaction
Transparency        Contexte & tokens · Cache · Compacting · Calibration
Administration      Config (env vars) · Providers · Logs/SQL · Sauvegardes/migrations
Reference           API REST · SSE events · SDK (@kinbot-developer/sdk) · CLI
Troubleshooting / FAQ
```

Principe : **chaque feature héros du site a une page doc dédiée** (cohérence marketing ↔ doc). Les "demo_ideas" des dossiers sont d'excellents canevas pour les tutoriels.

---

## 9. Questions ouvertes (à trancher avec le fondateur)

**Branding & nom**
- Le mot **"Kin"** : on l'expose dès la tagline ou on le révèle après "agents" ? (Je recommande : agents en surface, Kins juste après.)
- **Sherpa** : nom définitif du configurateur ? Risque de collision marque (matériel de montagne, autres SaaS "Sherpa"). À vérifier juridiquement.
- Identité visuelle de la marque KinBot elle-même (logo, mascotte ?) — l'avatar bundlé de Sherpa peut-il devenir un élément de marque ?

**Licence & modèle**
- **Open-source (MIT/Apache) vs source-available ?** Décision structurante : impacte le pitch "souveraineté/lock-in", l'adoption communautaire (cf. AnythingLLM MIT = 54k stars) et un éventuel modèle commercial futur. Le marketplace de plugins NPM suppose une communauté ouverte. **À trancher en priorité** — tout le reste en découle (badges, ton, /community).
- Modèle économique 1.0 : 100% gratuit/OSS, ou cloud hébergé payant + self-host gratuit (modèle Lobe/Open WebUI) en ligne de mire ?

**Ton & public**
- Ton de la comm : **technique-confiant** (homelab) ou **grand-public-rassurant** (la "simplicité de ChatGPT") ? Les deux cibles coexistent mais le ton du hero doit choisir. (Je penche pour un hero grand-public-rassurant, des sections techniques plus bas.)
- Assume-t-on publiquement la maturité ~80% (/roadmap honnête) ou positionne-t-on comme "1.0 solide" sans nuance ?

**Priorisation narrative**
- Validation du **réordonnancement des piliers** : la substance (mémoire/agents/souveraineté) en #1-2 plutôt que le polish (UI/Sherpa/avatars). C'est le pari le plus important du document.
- Met-on les **petites équipes/familles** en cible secondaire (#4, mon choix) ou en cible primaire conforme à la vision du fondateur ? Impacte tout le go-to-market.

**Concurrence & messaging**
- Inclure ou non **OpenClaw** nommément dans le comparatif public (rival direct omnicanal) ? Le nommer crédibilise mais lui fait de la pub.
- Stratégie face aux **émergents** (Hermes Agent, QwenPaw) sur la mémoire long-terme — veille interne ou réponse publique ?

**Risques à adresser**
- Le **coût LLM** est-il un frein à expliciter (BYO-API-key) ? La transparence tokens peut se retourner en "ça coûte cher" — à cadrer comme "vous maîtrisez vos coûts" plutôt que "voici la facture".
- Captcha HITL manuel, channel origins immatures, etc. (arêtes des dossiers) : à documenter honnêtement dans /roadmap ou à passer sous silence pour 1.0 ?

---

*Fin du premier jet. Prochaine étape suggérée : valider en priorité (a) licence OSS vs source-available, (b) l'ordre des piliers, (c) le ton du hero — ces trois décisions débloquent la rédaction du copy définitif.*
