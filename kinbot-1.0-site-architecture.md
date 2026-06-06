# KinBot 1.0 — Architecture du site & wireframes

> Document de conception du site GitHub Pages. Découle des décisions validées (licence MIT, ton grand-public-rassurant, cible primaire power-user solo / homelabbers, **substance d'abord + polish UI remonté tôt**, recadrage de catégorie « plateforme d'agents IA autonomes »). Source : `kinbot-1.0-messaging.md`, `kinbot-1.0-strategie-communication.md` (§5 et §6), `kinbot-1.0-catalogue-capacites.md`. Toute la copy de référence ci-dessous reprend le messaging validé, jamais d'invention de feature.

---

## 0. Principes directeurs (rappel, ils gouvernent chaque choix)

1. **Bénéfice d'abord, feature ensuite.** Chaque section ouvre sur une promesse (« Ils ne vous oublient jamais ») avant la mécanique (« mémoire hybride sqlite-vec + FTS5 »).
2. **Substance d'abord, polish tôt.** L'ordre des piliers (1 agents persistants → 2 self-hosted & self-improving → 3 UI belle → 4 Sherpa → 5 omnicanal → + confiance) gouverne le *pitch*. Mais l'ordre de *showcase* de la home diffère : on ouvre avec ce qui se *démontre* le mieux.
3. **Toujours une preuve après une promesse** — GIF, capture, chiffre. Chaque section héros a une `demo_idea` issue de §5.
4. **Catégorie = plateformes d'agents autonomes**, jamais fronts de chat. Le comparatif et le framing l'imposent partout.
5. **Honnêteté radicale** sur la maturité (~80%) — assumée sur `/roadmap`, cohérente avec l'ADN transparence et la cible homelab.
6. **« Agents » en surface, « Kins » révélé juste après le hook** — jamais ouvrir le hero avec « Kin ».

---

## 1. Arborescence raffinée

Point de départ : §6 de la stratégie. Raffinements apportés : ajout d'ancres home explicites, regroupement `/features` clarifié (les 5 sous-pages = les 5 piliers), `/why-kinbot` re-cadré « comparatif catégorie agents autonomes », `/roadmap` érigé en page de confiance à part entière, fusion `/blog`↔`/changelog` tranchée en `/changelog` (plus honnête pour un 1.0), `/showcase` rapproché de la communauté.

```
/                         Home — hero + 5 sections héros pleine largeur + bande "preuves légères"
                          + comparatif condensé (catégorie agents autonomes) + bande confiance + CTA quickstart
/features                 Vue d'ensemble des 8 héros + 6 preuves, regroupées par PILIER (les 5 piliers)
  /features/agents          Pilier 1 — Kins, session continue, mémoire hybride, sous-Kins, inter-Kin, contacts
  /features/platform        Pilier 2 — un conteneur/zéro infra + self-improving : custom tools, mini-apps, plugins/SDK, MCP, toolboxes
  /features/interface       Pilier 3 — PWA, 18 palettes, contraste adaptatif, design system, renderers riches, avatars, i18n
  /features/channels        Pilier 5 — omnicanal 6 plateformes, transfert de canal temps réel, livraison causal-chain
  /features/automation      Crons, webhooks, human-in-the-loop, scout, tasks (rattaché au socle runtime)
  /features/security        Pilier + confiance — vault jamais-au-LLM, comptes connectés, transparence tokens, multi-user isolé
/why-kinbot               Comparatif détaillé dans l'arène des AGENTS AUTONOMES + gaps de marché + "mauvaise catégorie" (fronts de chat)
/quickstart               docker run copiable, prérequis, première connexion, passage de relais à Sherpa
/showcase                 Galerie : mini-apps construites par les Kins, custom tools communautaires, captures UI multi-palettes
/roadmap                  Maturité ~80% assumée par domaine, rough edges honnêtes, priorités post-1.0
/docs                     → renvoie vers la doc technique (Starlight)
/community                Discord/Matrix, contribuer, écrire un plugin, code de conduite
/changelog               Releases, deep-dives techniques, annonces (remplace le couple blog/changelog pour un 1.0)
```

### Nav principale (réduite — réflexe homelab : aller vite à l'install et au code)

```
[Logo KinBot]   Features   Why KinBot   Docs   Roadmap   ★ GitHub      [ Démarrer en 2 min ]
```

- 5 entrées max + bouton CTA + lien GitHub avec compteur d'étoiles. `Roadmap` est dans la nav (pas relégué au footer) : c'est un **signal de confiance assumé**, pas une note de bas de page.
- Mobile : burger → mêmes entrées + CTA collant en bas d'écran.
- **Footer** (tout le reste) : Quickstart · Showcase · Changelog · Community · Sécurité & vie privée · Licence MIT · Mentions. Réseaux : GitHub, Discord/Matrix.

---

## 2. Stratégie de CTA (cohérente sur tout le site)

| Niveau | Libellé | Cible | Où | Intention |
|---|---|---|---|---|
| **Primaire** | **▶ Démarrer en 2 min** | `/quickstart` | Hero, nav (sticky), fin de home, fin de chaque page features | On vend la *facilité* (le `docker run` + Sherpa). C'est le seul CTA "achat". |
| **Secondaire** | **Voir la démo** | ancre vidéo Sherpa / collaboration inter-Kin | Hero, à côté du primaire | Hook visuel sans engagement. |
| **Tertiaire (dev)** | **★ Star on GitHub** | repo | Nav, footer, bandeau confiance | Conversion communauté/OSS, langage homelab. |
| **Contextuel** | **En savoir plus →** | sous-page `/features/*` ou `/docs/*` | Sous chaque section héros de la home | Routage substance pour qui veut creuser. |
| **Confiance** | **Lire la roadmap honnête →** | `/roadmap` | Bande confiance + footer | Désamorce le risque early-adopter. |

Règle : **un seul CTA primaire par pli**. Jamais deux boutons remplis côte à côte (primaire rempli + secondaire fantôme).

---

## 3. La HOME — structure et ordre

L'ordre de la home respecte le **pilier order validé pour le pitch**, tout en plaçant les démos les plus spectaculaires tôt. Décision tranchée (cf. §5 stratégie, recommandation « home moyenne ») : **5 sections héros pleine largeur sur la home**, les **8 héros complets sur `/features`**.

### Sélection des 5 héros pleine largeur de la HOME

On retient les héros qui (a) portent les piliers #1, #2, #3, #4 et la confiance, et (b) se démontrent le mieux. Substance d'abord, UI/polish présenté tôt, **Sherpa proéminent**.

| Ordre home | Section héros | Pilier porté | Pourquoi sur la home |
|---|---|---|---|
| 1 | **L'équipe de Kins en action** (collaboration + mémoire persistante) | Pilier 1 (substance) | Incarne le différenciateur #1, impossible chez les concurrents. On ouvre par la substance. |
| 2 | **Sherpa : votre setup en conversation** | Pilier 4 (Sherpa proéminent) | Le plus fort « wow, sans terminal ». Remonté tôt délibérément. |
| 3 | **Une IA d'agents enfin belle et fluide** (UI/PWA/18 palettes) | Pilier 3 (polish tôt) | Polish présenté tôt comme différenciateur de catégorie. |
| 4 | **Une plateforme qui s'améliore elle-même** (custom tools + mini-apps) | Pilier 2 (self-improving) | Le message rare : la base grandit de l'intérieur. |
| 5 | **Vos secrets ne voient jamais le LLM + zéro surprise de coûts** | + Confiance | Réassurance privacy/budget avant le comparatif et le CTA final. |

> Les 3 héros restants (**Omnicanal + transfert de canal**, **Mini-apps en tant que section dédiée**, **Transparence tokens en section dédiée**) apparaissent en *teaser* dans la bande « preuves légères » de la home et en **section pleine largeur sur `/features`**. L'omnicanal est mentionné dans le pitch 30s et la bande preuves, mais sa section pleine largeur vit sur `/features/channels` — choix assumé pour garder la home « moyenne ».

### Plan vertical complet de la home

```
[0] NAV (sticky)
[1] HERO
[2] PITCH 30 SECONDES (bande de 6 puces)
[3] HÉROS 1 — L'équipe de Kins en action            (pleine largeur, média à droite)
[4] HÉROS 2 — Sherpa, setup en conversation          (pleine largeur, média à gauche)
[5] HÉROS 3 — UI belle & fluide + palette switcher    (pleine largeur, média immersif)
[6] HÉROS 4 — Plateforme self-improving               (pleine largeur, média à droite)
[7] HÉROS 5 — Confiance : vault + transparence tokens (pleine largeur, média à gauche)
[8] BANDE "PREUVES LÉGÈRES" (grille de cartes : omnicanal, avatars, projets/Kanban, crons, comptes connectés, PWA)
[9] COMPARATIF CONDENSÉ (catégorie agents autonomes)
[10] BANDE CONFIANCE (OSS MIT · ~80% assumé · roadmap honnête · vault)
[11] CTA FINAL (quickstart)
[12] FOOTER
```

---

## 4. Wireframes — HOME

### [1] HERO

Reprend exactement le bloc hero validé (`messaging.md` §3).

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Logo KinBot]      Features  Why KinBot  Docs  Roadmap  ★GitHub  [▶ 2 min] │
├──────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   H1   Votre équipe d'IA, chez vous.                                   │
│                                                                        │
│   P    La simplicité d'un assistant grand public, la souveraineté de   │
│        votre serveur. Des agents qui se souviennent, collaborent et    │
│        grandissent avec vous — en un seul conteneur Docker.            │
│                                                                        │
│   [ ▶ Démarrer en 2 min ]    [ Voir la démo ]                          │
│                                                                        │
│   100% open-source (MIT) · self-hosted · zéro infra externe            │
│                                                                        │
│   ┌──────────────── média hero ────────────────┐                       │
│   │  GIF en boucle : chat KinBot, sidebar Kins   │  ← un seul GIF qui   │
│   │  + un transfert/collab visible (avatars)     │     claque           │
│   └──────────────────────────────────────────────┘                     │
└──────────────────────────────────────────────────────────────────────┘
```

- **CTA primaire** « Démarrer en 2 min » → `/quickstart`. **Secondaire** « Voir la démo » → scrolle/ouvre la démo Sherpa ou la collaboration inter-Kin.
- Sous-ligne de réassurance : licence + self-hosted + zéro infra — adresse le réflexe homelab dès le pli.
- **Démo/screenshot :** GIF unique le plus fort. Reprend le hook README : **Sherpa onboarding OU collaboration inter-Kin** (un seul, qui claque). Avatars distincts visibles pour signaler « équipe ».

### [2] PITCH 30 SECONDES

Bande des 6 puces validées (`messaging.md` §4), en grille 3×2 ou 2×3 selon le viewport.

```
┌──────────────────────────────────────────────────────────────────────┐
│  🧠 Des agents qui      🤝 Une équipe,        🛠️ Une plateforme qui    │
│     se souviennent         pas un chatbot          s'améliore elle-même│
│     session continue,      collaborent et          créent leurs outils,│
│     mémoire hybride,       délèguent à des          mini-apps & plugins │
│     jamais de reset        sous-agents                                  │
│                                                                        │
│  📱 Partout            📦 Un seul conteneur   🔒 Vos secrets           │
│     Telegram, WhatsApp,    zéro PG/Redis/Mongo.    restent à vous       │
│     Slack, Discord,        docker run, Sherpa       coffre chiffré,     │
│     Signal, Matrix + PWA   s'occupe du reste        jamais au LLM       │
└──────────────────────────────────────────────────────────────────────┘
```

---

### [3] HÉROS 1 — L'équipe de Kins en action (Pilier 1, substance)

Headline de section validée : **« Ils ne vous oublient jamais. »**

```
┌──────────────────────────────────────────────────────────────────────┐
│                                            ┌──────────────────────────┐│
│  Ils ne vous oublient jamais.              │  GIF collaboration:        ││
│                                            │  Kin "Recherche" ──request▶││
│  Une session continue, une mémoire qui     │  Kin "Rédaction" produit   ││
│  accumule des mois de contexte, une équipe │  le texte. Badges de queue ││
│  qui se passe le travail entre agents.     │  visibles, avatars distincts.│
│                                            │                            ││
│  • Session continue unique (pas de         │  ── split ──               ││
│    "nouvelle conversation")                │  Scroll historique 3 mois ;││
│  • Mémoire hybride sémantique + FTS        │  recall("décision budget") ││
│  • Sous-Kins await/async                   │  retrouve "600€" (FTS) ET  ││
│  • Inter-Kin request/reply                 │  "combien pour les courses"││
│  • Compacting sans suppression             │  (sémantique). Rien n'est  ││
│                                            │  supprimé.                 ││
│  En savoir plus → /features/agents         └──────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```

- **Demo idea (catalogue/§5 #1 + #3 fusionnés) :** GIF — un Kin « Recherche » envoie un `request` à un Kin « Rédaction » qui produit le texte sans intervention humaine entre les deux (badges de queue, avatars distincts). Puis split : scroll dans un historique de 3 mois ; `recall("décision budget")` retrouve « 600€ » (FTS exact) **et** « combien pour les courses » (sémantique). Montrer que rien n'est supprimé.
- Pourquoi héros : incarne le pilier #1, **impossible à montrer chez les concurrents** ; promesse émotionnelle « il me connaît » + preuve technique.

---

### [4] HÉROS 2 — Sherpa : votre setup en conversation (Pilier 4, proéminent)

Headline de section validée : **« Pas de YAML. Une conversation. »**

```
┌──────────────────────────────────────────────────────────────────────┐
│┌──────────────────────────┐                                            │
││  VIDÉO ~30s :              │   Pas de YAML. Une conversation.          │
││  fresh install → 3 écrans  │                                            │
││  (identité, langue, 1      │   Sherpa branche vos providers, sécurise  │
││  provider) → Sherpa salue  │   vos secrets et crée vos premiers agents │
││  → popup sécurisée pour    │   — en discutant.                         │
││  une clé (le secret        │                                            │
││  N'APPARAÎT JAMAIS dans le │   • Onboarding 3 écrans → puis chat guidé │
││  chat) → teste le provider │   • Secure input : secrets → vault,       │
││  → propose un 1er Kin.     │     jamais au LLM                         │
││                            │   • Une clé OpenAI = N capacités          │
││  [badge: secret ✓ valide]  │   • Sherpa reste accessible à vie         │
│└──────────────────────────┘                                            │
│                                          [ ▶ Démarrer en 2 min ]        │
│                                          En savoir plus → /quickstart   │
└──────────────────────────────────────────────────────────────────────┘
```

- **Demo idea (§5 #2) :** GIF/vidéo ~30s — fresh install → 3 écrans rapides → Sherpa salue, demande une clé via popup sécurisée (le secret n'apparaît **jamais** dans le chat), teste le provider, propose un premier Kin.
- Pourquoi héros + proéminent : le plus fort effet « wow, je peux faire ça sans terminal » ; différenciateur d'adoption grand public **unique sur le marché self-hosted**. CTA primaire dupliqué ici (la démo donne envie d'installer).

---

### [5] HÉROS 3 — Une IA d'agents enfin belle et fluide (Pilier 3, polish tôt)

Headline de section validée : **« Enfin une IA d'agents agréable à utiliser. »**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Enfin une IA d'agents agréable à utiliser.                            │
│  Dans le monde des agents autonomes, une UI à la fois complète, jolie  │
│  et responsive est rare. Ici, tout depuis une PWA soignée.             │
│                                                                        │
│  ┌──────────────────── PALETTE SWITCHER LIVE ─────────────────────┐    │
│  │ [aurora][ocean][forest][sunset][sakura][neon][midnight] …(18)  │    │
│  │                                                                 │    │
│  │   ┌── aperçu chat themé en direct ──┐   light / dark / system   │    │
│  │   │ message, carte outil rendu riche │   contraste normal/soft   │    │
│  │   └──────────────────────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  • PWA installable  • 18 palettes OKLch  • contraste adaptatif         │
│  • WCAG AA  • light/dark  • i18n (en/fr)  • outils au rendu riche      │
│                                            En savoir plus → /features/interface│
└──────────────────────────────────────────────────────────────────────┘
```

- **Demo idea (§5 « preuves » : 18 palettes / palette switcher live) :** switcher de palettes **interactif** sur la page (le visiteur clique aurora→ocean→neon et voit l'aperçu chat se re-thémer en direct, + toggle light/dark et normal/soft). Capture d'un outil rendu en carte themée (pas du JSON brut).
- Pourquoi héros tôt : polish = différenciateur **dans la bonne catégorie** (agents autonomes), pas relégué.

---

### [6] HÉROS 4 — Une plateforme qui s'améliore elle-même (Pilier 2)

Headline de section validée : **« Une base qui grandit avec vous. »**

```
┌──────────────────────────────────────────────────────────────────────┐
│  Une base qui grandit avec vous.            ┌──────────────────────────┐│
│                                             │ AVANT/APRÈS :              ││
│  Un `docker run`, zéro infra externe — et   │ tool météo Python créé en  ││
│  des agents qui créent leurs propres        │ live → ajout renderer.tsx  ││
│  outils, mini-apps et plugins.              │ → résultat en CARTE themée ││
│                                             │ (au lieu de JSON brut)     ││
│  • Monoprocess Bun + SQLite, zéro           │ ── puis ──                 ││
│    Postgres/Redis/Mongo/S3                  │ create_mini_app dashboard  ││
│  • Custom tools multi-langage + renderers   │ → 50+ composants rendus →  ││
│    React themés                             │ "Improve this" en langage  ││
│  • Mini-apps intégrées (SDK + 50 compos.)   │ naturel → le Kin édite →   ││
│  • Plugins NPM via SDK typé + marketplace   │ reload instantané          ││
│  • MCP dynamique · toolboxes                │                            ││
│                                             └──────────────────────────┘│
│  En savoir plus → /features/platform                                    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Demo idea (§5 #5 + #6 fusionnés) :** créer un tool météo Python en live → ajouter un `renderer.tsx` → résultat en carte themée au lieu de JSON brut (avant/après). Puis `create_mini_app` template dashboard → 50+ composants, dark mode toggle côté parent → re-render instantané ; « Improve this » en langage naturel → le Kin édite → reload.
- Pourquoi héros : le récit rare « la plateforme grandit de l'intérieur » ; le saut au-delà des « artifacts », très visuel ; parle aux devs/tinkerers.

---

### [7] HÉROS 5 — Vos secrets ne voient jamais le LLM (+ confiance/budget)

Headline de section validée : **« Transparent par conception. »**

```
┌──────────────────────────────────────────────────────────────────────┐
│┌──────────────────────────┐   Transparent par conception.             │
││ inspect Network :          │                                          │
││ POST secret               │   Vos secrets ne voient jamais le LLM ;   │
││ UI ─▶ serveur ─▶ vault     │   vous voyez chaque token consommé.       │
││      🔒 AES-256-GCM        │                                          │
││ réponse au LLM:            │   • Vault AES-256-GCM jamais exposé au LLM│
││   { valid: true }          │   • Coffre → seul `get_secret()` y touche│
││ (aucune valeur sensible)   │   • Comptes connectés locaux             │
││                            │   • Multi-user isolé                     │
││ ── Context Viewer ──       │                                          │
││ ▮système▮mémoires▮messages │   "Vous maîtrisez vos coûts" — pas        │
││ ▮outils  + cache hit 92%   │   "voici la facture".                    │
││ TTL 4m, calibration EMA    │                                          │
│└──────────────────────────┘   En savoir plus → /features/security      │
└──────────────────────────────────────────────────────────────────────┘
```

- **Demo idea (§5 #7 + #8 fusionnés) :** inspect Network — le POST du secret va UI→serveur→vault chiffré ; la réponse au LLM ne contient qu'un `valid=true` (schéma vault AES-256-GCM). Puis le **Context Viewer** : barre stacked multicolore (système/mémoires/messages/outils), breakdown par section, panel cache Anthropic (hit rate, TTL), calibration EMA per-Kin.
- Cadrage budget validé : **« vous maîtrisez vos coûts »**, jamais « voici la facture » (cf. risque §9 stratégie).
- Pourquoi héros : argument de confiance unique, parle aux privacy-conscious et budget-conscious ; personne grand public n'expose ça.

---

### [8] BANDE « PREUVES LÉGÈRES » (pas pleine largeur)

Grille de cartes compactes (1 ligne / 1 visuel mini / 1 lien). Reprend les « sections preuve plus légères » + les 3 héros non promus en pleine largeur sur la home.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Et aussi…                                                             │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │📱 Omnicanal │ │🎨 Avatars   │ │🗂️ Projets   │ │⏰ Crons &   │          │
│  │6 plateformes│ │auto-générés │ │Kanban +     │ │webhooks +   │          │
│  │+ transfert  │ │3 axes       │ │GitHub       │ │human-in-loop│          │
│  │de canal     │ │             │ │worktrees    │ │             │          │
│  │→ /channels  │ │→ /interface │ │→ /automation│ │→ /automation│          │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │📥 Comptes    │ │📲 PWA       │ │🧩 Mini-apps │ │📊 Transpar. │          │
│  │connectés    │ │installable  │ │par vos Kins │ │tokens live  │          │
│  │mail/cal     │ │             │ │→ /platform  │ │→ /security  │          │
│  │→ /security  │ │→ /interface │ │             │ │             │          │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘          │
└──────────────────────────────────────────────────────────────────────┘
```

- Visuels mini : galerie de 6 avatars de Kins ; palette switcher (déjà montré, ici en vignette) ; capture Kanban ; mini-démo transfert de canal (badge qui change).

---

### [9] COMPARATIF CONDENSÉ (catégorie agents autonomes)

Version courte du tableau §4 stratégie, **framée explicitement sur la bonne arène**. Décision : on met au centre les lignes où KinBot est seul en ✅.

```
┌──────────────────────────────────────────────────────────────────────┐
│  Comparé à quoi ? Aux plateformes d'agents autonomes — pas aux         │
│  simples fronts de chat.                                               │
│                                                                        │
│  ⓘ Open WebUI / Lobe Chat / LibreChat sont des fronts de chat LLM,     │
│    pas des plateformes d'agents persistants. Mauvaise catégorie.       │
│    La vraie arène : agents autonomes (GPTs/Assistants, OpenClaw, …).   │
│                                                                        │
│  Dimension                              KinBot   Autres plateformes    │
│  ───────────────────────────────────────────────────────────────     │
│  Session continue unique (pas de "new chat")  ✅        ❌             │
│  Collaboration inter-agents + sous-agents     ✅        ⚠️ / ❌        │
│  1 conteneur, zéro infra externe              ✅        ❌ lourd       │
│  Onboarding conversationnel (zéro YAML)        ✅ Sherpa  ❌            │
│  Vault secrets jamais exposé au LLM            ✅        ❌             │
│  Transparence tokens/contexte fine             ✅        ❌            │
│                                                                        │
│            [ Voir le comparatif complet → /why-kinbot ]               │
└──────────────────────────────────────────────────────────────────────┘
```

- **Framing validé :** se positionner contre les plateformes d'agents autonomes ; ne **jamais** se laisser comparer aux fronts de chat (l'encart ⓘ le dit explicitement et désamorce la mauvaise comparaison).
- Sur la home : 6 lignes max (celles où KinBot est seul en ✅). Tableau complet 8 colonnes → `/why-kinbot`.
- Note interne respectée : ne pas mettre les émergents (Hermes Agent, QwenPaw) dans le public ; OpenClaw nommé seulement comme exemple d'arène.

---

### [10] BANDE CONFIANCE

```
┌──────────────────────────────────────────────────────────────────────┐
│  100% open-source · MIT          Vos données, vos clés, sur votre infra│
│  Honnête sur la maturité (~80%, early-adopter)  →  Lire la roadmap →   │
│  Vos secrets ne voient jamais le LLM            ★ Star on GitHub       │
└──────────────────────────────────────────────────────────────────────┘
```

- Assume la maturité (cohérent §6 stratégie + ton honnête du messaging). Lien direct vers `/roadmap`.

### [11] CTA FINAL

```
┌──────────────────────────────────────────────────────────────────────┐
│            Votre équipe d'IA vous attend. En un docker run.            │
│                                                                        │
│   $ docker run -p 3000:3000 -v ./data:/data kinbot/kinbot   [copier]   │
│                                                                        │
│         [ ▶ Démarrer en 2 min ]      [ Lire la doc → ]                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Pages — but, audience, sections

### `/features` (vue d'ensemble)

- **But :** carte exhaustive des capacités, point d'entrée vers les 5 sous-pages-piliers. Héberge les **8 sections héros pleine largeur** (les 5 de la home + les 3 non promus).
- **Audience :** visiteur qui veut tout voir avant de creuser ; devs/intégrateurs.
- **Sections (ordre = pilier) :**
  1. Intro : « Tout ce que fait votre équipe » + ancres vers les 5 piliers.
  2. **Agents persistants** (héros : collaboration ; mémoire) → lien `/features/agents`.
  3. **Plateforme self-improving** (héros : custom tools+renderers ; mini-apps) → `/features/platform`.
  4. **Interface** (héros : UI/palettes ; avatars en preuve) → `/features/interface`.
  5. **Onboarding Sherpa** (héros : Sherpa) → `/quickstart`.
  6. **Omnicanal** (héros : transfert de canal — section pleine largeur ici) → `/features/channels`.
  7. **Confiance** (héros : vault ; transparence tokens — sections pleine largeur ici) → `/features/security`.
  8. **Automation** (crons/webhooks/HITL/scout) → `/features/automation`.
  9. CTA quickstart.

> **Répartition home vs /features des 8 héros :**
> - Home (pleine largeur) : 1-Collaboration+Mémoire · 2-Sherpa · 3-UI belle · 4-Self-improving (tools+mini-apps) · 5-Vault+Transparence.
> - `/features` (pleine largeur) : **les 8** — soit les 5 ci-dessus **plus** Omnicanal+transfert de canal, Mini-apps (section dédiée détachée de la fusion home), Transparence tokens (section dédiée détachée du vault). Les sous-pages-piliers reprennent ensuite chaque héros en profondeur.

#### `/features/agents` (Pilier 1)
- **But :** prouver « équipe persistante qui se souvient ». **Audience :** power-users, privacy, futures équipes.
- **Sections :** Session continue unique · Mémoire hybride (sqlite-vec KNN + FTS5, RRF, recall/memorize/forget) · Sous-Kins await/async · Inter-Kin request/reply (rate-limited, correlation IDs) · Compacting sans suppression · Registre de contacts partagé · Queue FIFO priorité utilisateur · Browser stateful (14 outils). CTA quickstart.
- **Wireframe :** non-héros (page texte+capture standard) — réutilise la démo collaboration/mémoire de la home en tête.

#### `/features/platform` (Pilier 2)
- **But :** « un conteneur, zéro infra **et** self-improving ». **Audience :** homelabbers, devs/tinkerers.
- **Sections :** Monoprocess Bun+SQLite, zéro PG/Redis/Mongo/S3 · Custom tools multi-langage + renderers React themés (validation bi-phase) · Mini-apps (SDK, 24 hooks, 50+ composants, backend Hono optionnel, snapshots) · Plugins NPM + SDK typé + marketplace décentralisé · MCP dynamique · Toolboxes (scoping fin, 9 intégrées). CTA quickstart + lien `/docs/extending`.

#### `/features/interface` (Pilier 3)
- **But :** polish comme différenciateur de catégorie. **Audience :** grand public prudent, mobiles, power-users.
- **Sections :** PWA installable (SW, offline app-shell) · 18 palettes OKLch + switcher live · contraste adaptatif normal/soft DB-synced · light/dark/system anti-flicker · design system glass/gradient · WCAG AA · renderers riches dans le fil · avatars auto-générés (3 axes) · i18n en/fr.

#### `/features/channels` (Pilier 5)
- **But :** « vos agents partout » + différencier vs OpenClaw (PWA multi-user + transfert temps réel). **Audience :** power-users, mobiles, futures équipes.
- **Sections :** Grille 6 logos (Telegram/WhatsApp/Slack/Discord/Signal/Matrix) · Transfert de canal temps réel (`transfer_channel`, contexte de handoff) · Envoi inter-Kin (préfixe d'identité) · Chaîne de causalité (`channelOriginId`) · Statuts de livraison · PWA comme 7ᵉ canal.
- **Héros pleine largeur ici** — wireframe :

```
┌──────────────────────────────────────────────────────────────────────┐
│  Vos agents, partout.                       ┌──────────────────────────┐│
│  6 messageries natives, et un agent peut    │ GIF : user écrit sur       ││
│  passer le canal à un spécialiste en        │ Telegram "parle-moi crypto"││
│  temps réel.                                │ → généraliste appelle      ││
│                                             │ transfer_channel → le BADGE││
│  [TG][WA][Slack][Discord][Signal][Matrix]   │ change EN DIRECT, le       ││
│                                             │ spécialiste reprend avec le││
│  • Transfert de canal temps réel            │ contexte du handoff.       ││
│  • Contexte de handoff transmis             │ + grille des 6 logos.      ││
│  • Chaîne de causalité (livraison auto)     └──────────────────────────┘│
└──────────────────────────────────────────────────────────────────────┘
```
- **Demo idea (§5 #4) :** user écrit sur Telegram « parle-moi crypto » → le Kin généraliste appelle `transfer_channel` → le badge change en direct, le spécialiste reprend avec le contexte du handoff. Montrer la grille des 6 logos.

#### `/features/automation`
- **But :** orchestration autonome. **Audience :** power-users, devs.
- **Sections :** Crons (POSIX/ISO8601, one-shot, approbation des crons créés par Kin) · Cron learnings · Webhooks (token SHA256, filtres, templates) · Human-in-the-loop (`prompt_human`) · Scout (délégation read-only modèle cheap) · Tasks (queue globale, snapshots gelés). Renvoi honnête vers `/roadmap` pour l'UI d'approbation des crons (pas finalisée 1.0).

#### `/features/security` (Pilier + confiance)
- **But :** souveraineté + zéro surprise de coûts. **Audience :** privacy-conscious, budget-conscious.
- **Sections :** Vault AES-256-GCM jamais au LLM · Secure input UI→vault · Références `$vault:` · Redaction bloquant le compacting · Comptes connectés (OAuth/IMAP/CalDAV, tokens jamais vus par les Kins, mode approbation d'envoi) · Transparence tokens (Context Viewer, double barre, cache live, calibration EMA) · Multi-user isolé.
- **Héros pleine largeur ici** (vault + transparence, mêmes démos que la home §[7], développées).

---

### `/why-kinbot`
- **But :** comparatif détaillé dans l'**arène des agents autonomes** + gaps de marché. Désamorce explicitement la « mauvaise catégorie ». **Audience :** évaluateurs techniques, Hacker News, sceptiques.
- **Sections :**
  1. **Recadrage de catégorie** : « KinBot est une plateforme d'agents autonomes personnels, pas un front de chat. » Encart « pourquoi Open WebUI / Lobe Chat / LibreChat ne sont pas la bonne comparaison ».
  2. **Tableau complet** (les 13 dimensions / 8 colonnes de §4 stratégie) avec légende ✅/⚠️/❌.
  3. **Les angles d'attaque** : lignes où KinBot est seul en ✅ (session continue, inter-agents, vault jamais-au-LLM, transparence tokens, onboarding conversationnel).
  4. **L'intersection vide** : narratif veille (personne ne réunit UX grand public + agents persistants + omnicanal + onboarding conversationnel en un conteneur ; OpenClaw fait l'omnicanal mais CLI mono-user).
  5. CTA quickstart + lien `/roadmap` (honnêteté).
- Respect note interne : émergents en veille interne, pas dans le tableau public.

### `/quickstart`
- **But :** convertir en installation en 2 minutes. **Audience :** homelabbers (cœur de cible).
- **Sections :** Prérequis (Docker, une clé LLM) · `docker run` copiable (bloc unique, bouton copier) · « ouvrez votre navigateur » · passage de relais à Sherpa (3 écrans → chat, secrets via popup sécurisée) · capture chat+sidebar · variantes (docker-compose, env vars vers `/docs`) · prochaine étape « créez votre premier Kin avec Sherpa ». CTA secondaire vers `/docs`.

### `/showcase`
- **But :** preuve sociale + inspiration (ce que les Kins construisent). **Audience :** devs, curieux. 
- **Sections :** Galerie mini-apps (dashboards, Kanban, charts — clonables) · Custom tools communautaires avec renderers · Captures UI à travers plusieurs palettes/light-dark · « Construit avec KinBot ». Lien `/community` pour contribuer.

### `/roadmap` — la page qui assume les ~80%
- **But :** **honnêteté radicale** sur la maturité, transformer le risque early-adopter en signal de confiance. **Audience :** homelabbers exigeants, contributeurs.
- **Cadre validé :** assumer publiquement (« les self-hosters respectent l'honnêteté », ADN transparence). Ton du messaging : « production-ready pour un usage individu / petite équipe, fondations solides, polish UX en cours ».
- **Sections :**
  1. **« Où en est KinBot : ~80%, et on vous dit où sont les arêtes. »** Promesse d'honnêteté.
  2. **Maturité par domaine** (tableau 3 niveaux, repris du catalogue) :
     - *Solide / production-ready* : runtime core, compacting, mémoire (cœur), inter-Kin, sous-Kins, prompt builder + cache, custom tools, MCP, UI/design system (1289 tests), mini-apps (cœur), comptes connectés (e2e), vault, transparence tokens, channels, plateforme power-user, toolboxes.
     - *Stable mais récent* : scout, hooks lifecycle plugins, enrichment agent.
     - *Partiel / prompt-dependent* : modale OnboardingChatModal de Sherpa (posture data-driven dépend du prompt-tuning).
  3. **Rough edges assumés (honnêtes, pas exhaustifs-anxiogènes)** : résolution captcha HITL manuelle ; glass morphism coûteux sur Android mid-range ; SW hand-coded ; `memories_vec` sync manuel ; bloc contacts/notes non borné en tokens ; UI d'approbation des crons Kin non finalisée 1.0 ; channel origins immatures ; pas de sandboxing VM des plugins (trust model npm/git admin-approved) ; Kanban mobile single-column ; emails en polling (pas de push). Chaque item formulé en « connu, documenté, sur la roadmap ».
  4. **Priorités post-1.0** (reprend les 6 reco du catalogue) : profiler glass morphism Android + fallback transparency · générer le CSS soft-contrast · migrer SW vers Workbox · audit a11y tiers · mémoire (trigger-sync `memories_vec`, borner contacts/notes, setter redactPending) · finaliser UI approbation crons + modale Sherpa.
  5. **Vision** : familles/petites équipes en expansion post-1.0 (collaboration partagée), marketplace de plugins.
  6. CTA : « Contribuez → `/community` » + « Suivez les releases → `/changelog` ».

### `/docs`
- **But :** rediriger vers la doc Starlight. **Sections :** mini-sommaire (Getting Started, Core Concepts, Extending, Channels, Security, Reference) + bouton « Ouvrir la doc ». Principe : chaque feature héros du site a une page doc dédiée (cohérence marketing↔doc).

### `/community`
- **But :** activer les évangélistes (devs/tinkerers, audience #2). **Sections :** Discord/Matrix · « Écrire un plugin » (SDK, scaffold `create-kinbot-plugin`) · Contribuer (issues, PR) · Code de conduite · Licence MIT.

### `/changelog`
- **But :** annonces, releases, deep-dives techniques. **Sections :** flux daté des releases · deep-dives (mémoire hybride, transfert de canal, compacting) · abonnement RSS/GitHub Releases. (Choix : `/changelog` plutôt que `/blog` — plus honnête et soutenable pour un 1.0.)

---

## 6. Récap des décisions structurantes

- **Nav :** Features · Why KinBot · Docs · Roadmap · ★GitHub + CTA primaire. Reste en footer. **Roadmap promu en nav** = signal de confiance.
- **CTA :** un primaire unique « Démarrer en 2 min » → `/quickstart`, secondaire « Voir la démo », tertiaire « Star on GitHub ». Un seul CTA rempli par pli.
- **Home :** ordre = pilier order validé, **5 sections héros pleine largeur** (Collaboration+Mémoire · Sherpa · UI · Self-improving · Vault+Transparence), Sherpa **proéminent** (CTA dupliqué), UI/polish **présenté tôt**.
- **Les 8 héros :** 5 en pleine largeur sur la home ; **les 8** en pleine largeur sur `/features` (ajout : Omnicanal+transfert, Mini-apps détachée, Transparence tokens détachée). Les 6 « preuves légères » (avatars, palettes, projets/Kanban, crons, comptes connectés, PWA) en bande de cartes + sous-pages.
- **Comparatif :** framé sur la catégorie **agents autonomes** ; encart explicite « les fronts de chat ne sont pas la bonne comparaison » ; 6 lignes sur la home, tableau complet sur `/why-kinbot` ; émergents en veille interne.
- **`/roadmap` :** assume les ~80% par domaine + rough edges honnêtes + priorités post-1.0, cadré « connu et documenté » — cohérent avec le ton honnête et la cible homelab.

Fichier source produit : ce document est destiné à `/Users/nicolasvarrot/projects/kinbot/kinbot-1.0-site-architecture.md` (à créer par l'orchestrateur si souhaité ; non écrit ici car la consigne demande le markdown verbatim en sortie).