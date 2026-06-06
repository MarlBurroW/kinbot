# KinBot 1.0 — Directions de design du site

> 3 directions visuelles distinctes pour la refonte du site. Recommandation en fin de document.

## ✅ Décision retenue : **Foyer** (hero) + accents **Constellation** (sections preuve)

Direction maîtresse = **Foyer** (foyer numérique : crème/lin, serif éditoriale, accent violet app réservé aux CTA/Kins, avatars de Kins vivants, dark = nuit douce aurora). Elle incarne la tagline « Votre équipe d'IA, chez vous. » et le ton grand-public-rassurant validé.

**Arc de page acté :** chaleureux en haut (hero + piliers émotionnels 1/3/4 en langage Foyer) → bascule vers le vocabulaire **Constellation** (constellation d'agents animée, bento, mono, `gradient-border-spin`) dans les sections « preuve » techniques plus bas (piliers 2/5 + transparence), pour les homelabbers. Cohérence avec l'app via les tokens, glows, radius et animations existants.

### Affinages validés (tour 2)

- **Dark only** — pas de version claire.
- **Typographie : tout sans-serif, voie « chaleureux »** (variante B). La serif (Fraunces) créait une dissonance avec le dark/glow → abandonnée. Titres en **Plus Jakarta Sans** (police de l'app), poids 800, ronds et généreux ; la chaleur passe par la rondeur, les **glows pêche** et la copy.
- **Icônes : zéro emoji.** UI → **lucide** (= `lucide-react` de l'app). Logos providers IA → **@lobehub/icons** (couleur, comme `src/client/components/common/ProviderIcon.tsx`). Logos channels/marques/langages → **simple-icons** (= `react-icons/si`).
- **Screenshots** : placeholders balisés + fondu (mask-image), jamais de cadre net.
- **Avatars** : header pioche au hasard dans `AVATAR_POOL` ; bande défilante pleine largeur avec fondu.

Fichier de référence dev : `design-preview/foyer-dark.html` (alternatives explorées : `foyer.html` clair, `foyer-dark-typo.html` comparaison typo).

### ✅ DIRECTION RETENUE (tour 3) — « peau de l'app + os éditoriaux »

Fichier canonique : **`design-preview/foyer-dark-v2.html`**.

Constat : la version chaleureux-glow (`foyer-dark.html`) sentait encore trop le « AI-generated » (cf. [`kinbot-1.0-anti-ai-slop.md`](./kinbot-1.0-anti-ai-slop.md)) ; le concept éditorial pur (`concept-manual.html`) était superbe mais tranchait trop avec l'identité de l'app (qu'on ne refait pas). **La synthèse garde la peau de l'app et change les os.**

- **Peau (inchangée, = app)** : palette aurora (violet→rose→pêche), glass, glows, `Plus Jakarta Sans`, icônes lucide, logos providers `@lobehub/icons` + marques `simple-icons`. Site et app = même famille, zéro refonte côté KinBot.
- **Os (éditoriaux, c'est ce qui dé-IA)** :
  - **Sections numérotées 01–04** avec numéraux en gradient aurora + **filets fins** entre sections (un document, pas une landing).
  - **Métadonnées en mono** partout : masthead `KinBot v1.0 · self-hosted · MIT`, kickers mono avec tiret, **colophon** (`External infra: none`, `Set up by: a conversation`), tables de specs.
  - **Panneau « // your kins » façon produit** dans le hero (Sherpa online, Atlas working…) au lieu de cartes glass flottantes — relie site↔produit.
  - **Casting / annuaire** « The household » (grille de Kins en cadres, numérotés) au lieu de triplets d'icônes.
  - **Figures légendées** (`Fig. 1 — recall`, `Fig. 2 — a tool renders as UI`) avec slot screenshot en fondu.
  - **Retenue** : 2 glows doux max (réchauffés pêche), pas de blobs gratuits, radius/poids variés, asymétrie.
- **Langue du site : anglais.**

Garde-fous anti-IA appliqués : pas de hero centré + 2 boutons, pas de bento décoratif, pas de cartes flottantes vides, accent pêche pour casser le violet, copy humaine.

---

## Direction 1 — Foyer (Le foyer numérique)

**Vibe.** Chaleureux, domestique, rassurant. On ne vend pas une infra, on vend un chez-soi : une équipe qui habite votre serveur comme on habite une maison. Le ton est posé, humain, presque cosy — l'IA grand public sans la froideur du SaaS.

**Palette.** Base claire crème/lin (off-white tiède, jamais blanc clinique), texte encre profonde. Accent unique : le violet primaire de l'app (oklch primary ~0.52/300) réservé aux CTA et aux Kins. Touches secondaires pêche/sakura tirées des glows aurora existants pour la chaleur. Dark mode = nuit douce (le `--color-background` aurora dark 0.11/295), pas un noir techy. Surfaces en color-mix très bas dosage, comme dans surface-card.

**Typographie.** Titres en serif humaniste éditoriale (Fraunces ou Source Serif) pour la chaleur et la confiance — un vrai signal de rupture vs le tout-sans-serif des plateformes agentiques. Corps en Plus Jakarta Sans (la police de l'app) pour la continuité. Échelle douce, contrastée : gros titres mais line-height généreux, pas de capitales criardes.

**Layout.** Aéré, basse densité, beaucoup de respiration. Colonnes étroites façon lecture. Cartes arrondies 2xl (radius de l'app) en surface-card glass subtil, ombres douces (shadow-md/lg existants). Dispositif visuel signature : des 'pièces' — chaque pilier présenté comme une scène de vie (un Kin qui se souvient, un Kin qui répond sur Telegram pendant que vous dormez). Avatars de Kins ronds et présents partout, comme une famille. Hero asymétrique : texte à gauche, scène vivante à droite.

**Motion.** Douce et organique. Réutilise animate-levitate (avatars qui flottent légèrement), fade-in-up à l'apparition, pulse-glow discret sur le Kin actif. Pas de parallax agressif. Transitions lentes (300-500ms), easing moelleux. Le mouvement suggère la présence vivante, pas la performance.

**Différenciation.** Rupture nette : aujourd'hui le marché des plateformes d'agents (et le site actuel) est froid, sombre, techy, sans-serif. Un site crème, serif, domestique, centré sur des avatars vivants est inédit dans la catégorie — il incarne littéralement 'grand-public rassurant' et le mot 'chez vous'. Aucun concurrent (OpenClaw CLI, fronts de chat) ne joue la carte chaleur/famille.

**Cohérence avec le design system app.** Reprend exactement les tokens de l'app : violet primaire pour CTA/Kins, glows aurora en versions ultra-douces, radius 2xl, surface-card, shadow-md/lg, animate-levitate, pulse-glow. Le site = la version 'salon' de l'app, l'app = la version 'cuisine où on travaille'. La serif est la seule liberté éditoriale, le corps reste en Plus Jakarta Sans : on reconnait la même main.

**Aperçu hero :**

```
+----------------------------------------------------------+
| (o) KinBot                  Features  Why  Docs  GitHub   |
+----------------------------------------------------------+
|                                          .-.   .-.        |
|  Votre equipe d'IA,                     (o o) (o o)  <-Kins|
|  chez vous.                              '-'   '-'  flottent|
|                                            .-.            |
|  La simplicite d'un assistant grand-pub.  (o o)          |
|  La souverainete de votre serveur.         '-'           |
|                                                          |
|  [ Demarrer en 2 min ]   ( Voir la demo )                |
|                                                          |
|  100% open-source MIT . self-hosted . zero infra externe |
+----------------------------------------------------------+
```

---

## Direction 2 — Constellation (Le cockpit d'agents)

**Vibe.** Bold, techy, vivant. On assume la catégorie 'plateforme d'agents autonomes' : un poste de pilotage où une équipe d'agents s'orchestre en temps reel. Confiant et spectaculaire, mais sans survente — la preuve est dans la démo animée, pas dans l'adjectif.

**Palette.** Dark-first, plein cadre. Fond nuit aurora (oklch 0.11/295) avec gradient-mesh radial vivant. Le gradient signature violet->magenta->pêche (gradient-primary de l'app) devient le héros : utilisé en gradient-text sur les titres clés, gradient-border sur les cartes actives, gradient-border-spin sur l'élément focus. Light mode existe mais le canon de marque est le dark. Lueurs glow-1/2/3 plus saturées qu'en app.

**Typographie.** Sans-serif technique à fort caractère : Geist ou Space Grotesk pour les titres (géométrique, moderne, légèrement 'machine'), corps en Plus Jakarta Sans. Mono (JetBrains Mono / Geist Mono) pour les snippets `docker run`, les noms de tools, les badges de tokens — le mono devient un motif graphique récurrent, signe de la substance technique.

**Layout.** Dense, riche, structuré comme un dashboard. Hero plein écran avec une 'carte d'agents' animée : noeuds (Kins) reliés par des fils lumineux qui pulsent quand un agent passe le travail à un autre (incarnation visuelle du pilier collaboration). Sections en bento-grid de cartes glass-strong + gradient-border, chacune montrant une capacité réelle (Context Viewer, mémoire, transfert de canal). Badges, barres de tokens stacked, queue counters — on expose la machinerie comme une fierté.

**Motion.** Riche et orchestrée. gradient-border-spin sur le Kin actif, fils de constellation qui s'illuminent en séquence (causal-chain visuel), shimmer/shine-sweep sur les CTA (btn-shine), pulse-glow sur les noeuds, running-pulse sur les agents 'en cours'. Scroll-triggered : les cartes bento s'assemblent. Toujours bornée pour rester lisible (respect WCAG, pas de chaos).

**Différenciation.** Rupture par l'intensité et la mise en scène de l'orchestration. Le site actuel et les concurrents montrent des captures statiques ou du texte ; ici on montre l'équipe d'agents qui travaille, en mouvement, dès le hero. C'est le seul angle qui rend visible le différenciateur n.1 (collaboration inter-agents) que personne ne peut copier. Mono + bento + constellation = vocabulaire 'plateforme', pas 'chatbot'.

**Cohérence avec le design system app.** C'est la traduction la plus littérale du design system existant : gradient-primary, gradient-border(-spin), glass-strong, gradient-mesh, pulse-glow, btn-shine, running-pulse sont déjà en prod dans l'app. Le site dark-aurora est quasi indiscernable de l'app — risque : trop proche. On crée la distance par l'échelle (full-bleed, animations héroiques) et le mono comme accent de marque que l'app n'utilise pas au même degré.

**Aperçu hero :**

```
+----------------------------------------------------------+
|  KinBot //                  Features  Why  Docs  GitHub   |
+==========================================================+
|                                                          |
|  VOTRE EQUIPE D'IA,            (Kin)====fil lumineux===.  |
|  CHEZ VOUS.                      ||  \\               ||  |
|  <- gradient-text aurora       (Kin)   \\===========(Kin) |
|                                  Recherche  ->  Redaction |
|  Des agents qui se souviennent,                          |
|  collaborent, grandissent avec vous.                    |
|                                                          |
|  [ Demarrer en 2 min ]>  [ Voir la demo ]               |
|  $ docker run kinbot   <- mono, copiable                 |
|  MIT . self-hosted . zero infra externe                 |
+----------------------------------------------------------+
```

---

## Direction 3 — Atelier (Editorial souverain)

**Vibe.** Élégant, éditorial, crédible. Le ton d'un produit logiciel sérieux et durable qu'on installe pour des années — proche de l'esthétique Linear/Stripe/Vercel mais avec l'âme aurora. Calme, dense en preuves, premium sans être froid. Rassure par la maîtrise plutôt que par la chaleur.

**Palette.** Quasi-monochrome maîtrisé : grands aplats neutres (slate clair OU graphite, selon light/dark), texte haute lisibilité, et la COULEUR utilisée comme encre rare — un seul trait de gradient aurora par section, jamais deux. Le violet primaire ponctue (liens, accents, le Kin actif). Inspiration directe de la palette 'slate'/'monochrome' de l'app, relevée d'un filet aurora. Light et dark co-canon, parfaitement symétriques.

**Typographie.** Pairing éditorial premium : titres en sans-serif de précision (Inter Display ou Geist) très serrés (tight tracking, gros poids), sous-titres et corps en Plus Jakarta Sans. Usage assumé de la hiérarchie typographique comme dispositif principal (peu d'images décoratives). Mono discret pour le code. Échelle ferme et confiante, lettrage net.

**Layout.** Grille éditoriale stricte, haute densité d'information mais respirée par des règles fines (border-border 1px) et beaucoup de blanc/noir. Pas de glass criard : surfaces plates surface-card légères, séparateurs nets, alignements rigoureux. Dispositif signature : des 'specimens' — chaque feature montrée comme une fiche technique soignée (capture nette dans un cadre fin + 3 puces bénéfice). Tableau comparatif assumé en pièce maîtresse. Hero sobre, centré ou aligné gauche, une seule capture produit nette dessous.

**Motion.** Sobre et précise. Fade-in / scale-in discrets au scroll, transitions courtes (150-250ms), un seul gradient-border-animated lent sur l'élément focal de chaque section. btn-press / btn-magnetic sur les CTA (feedback tactile, pas de spectacle). Le mouvement signale la qualité d'exécution, jamais la décoration.

**Différenciation.** Rupture par la retenue. Là où la catégorie agentique abuse du gradient, du néon et du 'futuriste', un site éditorial calme et dense en preuves signale la maturité et la crédibilité — exactement ce qu'attend un homelabber qui va confier son infra. C'est aussi une distance nette vs le site actuel (très aurora) : la couleur devient rare et donc précieuse. Positionne KinBot comme un logiciel sérieux, pas une démo flashy.

**Cohérence avec le design system app.** S'appuie sur les palettes les plus sobres de l'app (slate, monochrome) qui existent déjà parmi les 18, et sur les tokens neutres (border-border, muted-foreground, surface-card plat). Le filet aurora rare est le pont avec l'app : même gradient, dosé homéopathiquement. Réutilise btn-press, btn-magnetic, gradient-border-animated, fade/scale-in. Le site est la 'vitrine premium', l'app garde son exubérance aurora — cohérence par les tokens partagés, contraste de densité voulu.

**Aperçu hero :**

```
+----------------------------------------------------------+
|  KinBot                     Features  Why  Docs  GitHub   |
+----------------------------------------------------------+
|                                                          |
|              Votre equipe d'IA, chez vous.               |
|       ----------------------------------------           |
|     La simplicite d'un assistant grand-public,           |
|     la souverainete de votre serveur.                    |
|                                                          |
|          [ Demarrer en 2 min ]   Voir la demo            |
|          MIT . self-hosted . zero infra externe          |
|                                                          |
|   +--------------------------------------------------+   |
|   |  [ capture nette de l'app : chat + sidebar Kins ]|   |
|   +--------------------------------------------------+   |
+----------------------------------------------------------+
```

---

## Recommandation

Je recommande **Foyer (Le foyer numérique)**, avec un emprunt tactique à Constellation. Raisons : (1) Le ton validé est 'grand-public rassurant' et la tagline est 'Votre équipe d'IA, chez vous.' — Foyer est la seule des trois directions qui incarne littéralement la chaleur, la domesticité et la métaphore d'équipe/famille, là où Constellation parle surtout aux power-users et Atelier surtout à la crédibilité. (2) Foyer 'marque le coup' sans trahir l'app : la serif éditoriale + le fond crème + les avatars de Kins vivants sont une rupture franche vs le site actuel (très aurora) ET vs toute la catégorie (froide, sombre, sans-serif), tout en réutilisant les tokens, glows, radius et animations existants — site et app restent une même famille. (3) Elle sert le pari narratif validé (substance émotionnelle d'abord : 'ils ne vous oublient jamais'), le bénéfice avant la feature. Le risque de Constellation est d'être trop proche de l'app (mêmes gradients) et trop techy pour le hero grand-public ; le risque d'Atelier est de paraître générique (Linear-like) et froid pour la cible émotionnelle du haut de page. La synthèse gagnante : adopter Foyer comme direction maîtresse pour le hero et les sections émotionnelles (piliers 1, 3, 4), puis basculer vers le vocabulaire Constellation (constellation d'agents animée, bento, mono, gradient-border-spin) dans les sections 'preuve' plus bas pour les homelabbers (piliers 2, 5, transparence). On obtient un site chaleureux en haut, techniquement crédible en bas — exactement l'arc 'grand-public rassurant en haut, sections techniques plus bas' acté dans la stratégie.
