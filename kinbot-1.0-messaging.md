# KinBot 1.0 — Messaging & voix de marque

> Socle de communication. Découle des décisions validées (licence MIT, ton grand-public-rassurant, cible power-user solo, substance d'abord + polish remonté tôt) et du recadrage de catégorie : **KinBot est une plateforme d'agents IA autonomes personnels**, pas un front de chat. Toute la copy (site, README, doc, stores) s'aligne sur ce document.

---

## 1. La big idea (positionnement)

> **KinBot, c'est votre propre équipe d'agents IA — qui se souviennent, collaborent et vous répondent partout — installée sur votre serveur en un seul conteneur.**

Trois mots-clés portent tout : **équipe d'agents persistants** (pas un chatbot) · **mémoire** (qui vous connaissent) · **souveraineté simple** (chez vous, un conteneur). Le quatrième, plus subtil, est l'angle qui surprend : la plateforme **s'améliore elle-même** (les agents créent leurs propres outils, mini-apps et plugins).

---

## 2. Tagline

### Recommandée (hero du site + README)

> # Votre équipe d'IA, chez vous.
> **La simplicité d'un assistant grand public, la souveraineté de votre serveur.** Des agents qui se souviennent, collaborent, et grandissent avec vous — en un seul conteneur.

- **Headline :** « Votre équipe d'IA, chez vous. » — courte, mémorable, porte *équipe* (≠ chatbot) + *souveraineté*.
- **Sous-titre :** explicite le gap de marché (simplicité grand-public **+** self-hosted) et glisse les piliers (mémoire, collaboration, self-improving, un conteneur).

### Variantes (à départager / réutiliser ailleurs)

| Variante | Usage idéal | Ton |
|---|---|---|
| **« Votre équipe d'IA, chez vous. »** | Hero principal, README | Grand-public, chaleureux *(reco)* |
| **« La simplicité de ChatGPT. La souveraineté de votre serveur. »** | Pub, accroche réseaux, A/B test | Grand-public, comparatif direct |
| **« Des agents qui se souviennent, collaborent, et ne quittent jamais votre serveur. »** | Audience tech/privacy, Hacker News, /why-kinbot | Technique, dense |
| **« Une équipe d'IA qui grandit avec vous. »** | Angle self-improving, blog | Émotionnel, évolutif |

> **Note nom « Kin » :** en surface marketing on parle d'« agents » (compris immédiatement) ; « Kin » est révélé juste après le hook comme terme propriétaire (effet de marque sans friction). Ne pas ouvrir le hero avec « Kin ».

---

## 3. Bloc hero (structure type)

```
[Logo KinBot]

H1   Votre équipe d'IA, chez vous.
P    La simplicité d'un assistant grand public, la souveraineté de votre
     serveur. Des agents qui se souviennent, collaborent et grandissent
     avec vous — en un seul conteneur Docker.

[ ▶ Démarrer en 2 min ]   [ Voir la démo ]        ← CTA primaire / secondaire

Sous-ligne   100% open-source (MIT) · self-hosted · zéro infra externe
```

- **CTA primaire :** orienté action immédiate (« Démarrer en 2 min » → /quickstart). On vend la facilité.
- **CTA secondaire :** « Voir la démo » → GIF/vidéo Sherpa ou collaboration inter-Kin.
- **Sous-ligne de réassurance :** licence + self-hosted + zéro infra. Adresse les réflexes de la cible homelab dès le pli.

---

## 4. Pitch 30 secondes (puces — README & home)

- 🧠 **Des agents qui se souviennent** — session continue, mémoire hybride, jamais de reset.
- 🤝 **Une équipe, pas un chatbot** — vos agents collaborent et délèguent à des sous-agents.
- 🛠️ **Une plateforme qui s'améliore elle-même** — vos agents créent leurs outils, mini-apps et plugins.
- 📱 **Partout** — Telegram, WhatsApp, Slack, Discord, Signal, Matrix + une PWA soignée.
- 📦 **Un seul conteneur** — zéro Postgres/Redis/Mongo. `docker run`, et Sherpa s'occupe du reste.
- 🔒 **Vos secrets restent à vous** — coffre chiffré jamais exposé au LLM.

---

## 5. Messaging par pilier (one-liners réutilisables)

| Pilier | Headline de section | Sous-ligne |
|---|---|---|
| 1. Agents persistants | **Ils ne vous oublient jamais.** | Une session continue, une mémoire qui accumule des mois de contexte, une équipe qui se passe le travail. |
| 2. Self-hosted & self-improving | **Une base qui grandit avec vous.** | Un `docker run`, zéro infra externe — et des agents qui créent leurs propres outils, mini-apps et plugins. |
| 3. UI d'agents belle & fluide | **Enfin une IA d'agents agréable à utiliser.** | Tout depuis une PWA soignée : 18 thèmes, responsive, des outils au rendu riche dans le fil. |
| 4. Onboarding Sherpa | **Pas de YAML. Une conversation.** | Sherpa branche vos providers, sécurise vos secrets et crée vos premiers agents — en discutant. |
| 5. Omnicanal | **Vos agents, partout.** | 6 messageries natives, et un agent peut passer le canal à un spécialiste en temps réel. |
| + Confiance | **Transparent par conception.** | Vos secrets ne voient jamais le LLM ; vous voyez chaque token consommé. |

---

## 6. Voix & ton

**On est :** chaleureux, concret, confiant, honnête. On parle de *ce que tu peux faire en 2 minutes*, pas d'architecture dans les 3 premières lignes.

**Mots qu'on utilise :** équipe, agents, se souviennent, chez vous, en un conteneur, grandit avec vous, partout, vos données, vos clés, en clair, sans surprise.

**Mots qu'on évite :** « révolutionnaire », « propulsé par l'IA », « next-gen », jargon interne non expliqué (Kin/sous-Kin avant introduction), promesses vagues (« productivité décuplée »), survente (« le meilleur », « ultime»).

**Règles :**
- Toujours montrer une preuve (GIF, capture, chiffre) après une promesse.
- Honnêteté sur la maturité (~80%, early-adopter) plutôt que survente — c'est cohérent avec la cible homelab et l'ADN transparence.
- Catégorie : se positionner contre les **plateformes d'agents autonomes**, jamais se laisser comparer aux simples fronts de chat.
- Bénéfice d'abord, feature ensuite (« Ils ne vous oublient jamais » avant « mémoire hybride sqlite-vec + FTS5 »).
