<p align="center">
  <!-- TODO: remplacer par le logo officiel KinBot (SVG/PNG, fond transparent, ~320px de large) — alt="Logo KinBot" -->
  <img src="docs/assets/logo.png" alt="Logo KinBot" width="320" />
</p>

<h1 align="center">Votre équipe d'IA, chez vous.</h1>

<p align="center">
  <strong>La simplicité d'un assistant grand public, la souveraineté de votre serveur.</strong><br />
  Une plateforme self-hosted d'agents IA persistants qui se souviennent, collaborent et vous répondent partout — en un seul conteneur.
</p>

<p align="center">
  <!-- Licence -->
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-MIT-22c55e?style=flat-square" alt="Licence MIT" /></a>
  <!-- Version / Release -->
  <a href="https://github.com/MarlBurroW/kinbot/releases"><img src="https://img.shields.io/github/v/release/MarlBurroW/kinbot?style=flat-square&color=a855f7" alt="Dernière release" /></a>
  <!-- Build / CI -->
  <a href="https://github.com/MarlBurroW/kinbot/actions/workflows/ci.yml"><img src="https://github.com/MarlBurroW/kinbot/actions/workflows/ci.yml/badge.svg" alt="Build CI" /></a>
  <!-- Docker pulls -->
  <a href="https://github.com/MarlBurroW/kinbot/pkgs/container/kinbot"><img src="https://img.shields.io/badge/Docker-ghcr.io-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Image Docker" /></a>
  <!-- Stars -->
  <a href="https://github.com/MarlBurroW/kinbot"><img src="https://img.shields.io/github/stars/MarlBurroW/kinbot?style=flat-square&color=ec4899" alt="GitHub Stars" /></a>
  <!-- Discord -->
  <a href="#-communauté--support"><img src="https://img.shields.io/badge/Discord-rejoindre-5865F2?style=flat-square&logo=discord&logoColor=white" alt="Discord" /></a>
  <!-- Made with Bun -->
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/made%20with-Bun-000000?style=flat-square&logo=bun&logoColor=white" alt="Made with Bun" /></a>
</p>

<p align="center">
  100% open-source (MIT) · self-hosted · zéro infra externe
</p>

<p align="center">
  <a href="https://marlburrow.github.io/kinbot/">Site</a> ·
  <a href="https://marlburrow.github.io/kinbot/docs/">Documentation</a> ·
  <a href="#-démarrer-en-2-minutes">Quickstart</a> ·
  <a href="#-fonctionnalités">Fonctionnalités</a> ·
  <a href="#-pourquoi-kinbot">Comparatif</a> ·
  <a href="#-architecture">Architecture</a>
</p>

---

<p align="center">
  <!-- TODO: GIF hero unique et fort — la collaboration inter-Kin OU l'onboarding Sherpa (~10-15s, boucle propre). alt="Démo KinBot : des agents qui collaborent en temps réel" -->
  <img src="docs/assets/hero.gif" alt="Démo KinBot : des agents qui collaborent en temps réel" width="100%" />
</p>

---

## Le pitch en 30 secondes

KinBot n'est pas un énième front de chat. C'est une **équipe d'agents IA autonomes** — les *Kins* — qui vivent sur votre serveur, gardent leur mémoire, et travaillent ensemble.

- 🧠 **Des agents qui se souviennent** — une session continue unique (jamais de « nouvelle conversation »), une mémoire hybride qui accumule des mois de contexte, jamais de reset.
- 🤝 **Une équipe, pas un chatbot** — vos Kins collaborent (`request`/`reply`) et délèguent à des sous-agents pour abattre le travail en parallèle.
- 🛠️ **Une plateforme qui s'améliore elle-même** — vos agents créent leurs propres outils, construisent des mini-apps et publient des plugins. La base grandit avec vous.
- 📱 **Partout** — Telegram, WhatsApp, Slack, Discord, Signal, Matrix + une PWA soignée. Un Kin peut passer le canal à un spécialiste en temps réel.
- 📦 **Un seul conteneur** — zéro Postgres, Redis, Mongo ou broker de queue. `docker run`, et Sherpa s'occupe du reste.
- 🔒 **Vos secrets restent à vous** — coffre chiffré AES-256-GCM, jamais exposé au LLM.

---

## 🚀 Démarrer en 2 minutes

Une seule commande. Pas de `docker-compose`, pas de YAML, pas de base de données à provisionner.

```bash
docker run -d \
  --name kinbot \
  -p 3000:3000 \
  -v kinbot-data:/app/data \
  ghcr.io/marlburrow/kinbot:latest
```

Puis **ouvrez votre navigateur sur [http://localhost:3000](http://localhost:3000) — Sherpa s'occupe du reste.**

Pas d'étape de config manuelle : trois écrans rapides (identité, langue, une clé LLM), puis **Sherpa**, votre agent configurateur, prend le relais *par conversation*. Il branche vos providers, sécurise vos secrets dans le coffre (jamais transmis au LLM), et crée vos premiers Kins. Il reste accessible à vie.

> 💡 Pour exposer KinBot sur votre réseau ou derrière un reverse proxy, ajoutez `-e HOST=0.0.0.0` et `-e PUBLIC_URL=https://votre-domaine`. Voir [la doc de configuration](https://marlburrow.github.io/kinbot/docs/) pour toutes les variables d'environnement.

<p align="center">
  <!-- TODO: capture d'écran de l'UI — fil de chat + sidebar des Kins, palette claire et soignée. alt="Interface KinBot : chat et sidebar des Kins" -->
  <img src="docs/assets/screenshot-ui.png" alt="Interface KinBot : chat et sidebar des Kins" width="100%" />
</p>

---

## ✨ Fonctionnalités

Toutes les capacités sont détaillées sur le **[site](https://marlburrow.github.io/kinbot/)** et la **[documentation](https://marlburrow.github.io/kinbot/docs/)**. Le cœur, en bref :

**🧠 Des agents persistants qui collaborent**
- Identité, expertise et **mémoire long terme** stables par Kin
- **Session continue unique** partagée — le Kin sait toujours où il en est
- **Mémoire hybride** : recherche sémantique (sqlite-vec KNN) + plein texte (FTS5), fusionnée par Reciprocal Rank Fusion ; extraction automatique + outils explicites (`recall` / `memorize` / `forget`)
- **Compacting progressif** qui résume sans jamais supprimer les originaux
- **Sous-Kins** (tâches éphémères) en modes `await` / `async`, **messagerie inter-Kin** (`request` / `reply`), **registre de contacts** unifié

**🛠️ Une plateforme self-hosted & self-improving**
- Monoprocess **Bun + SQLite**, un seul conteneur, **zéro infra externe**
- **Custom tools** multi-langage (Python, Node, Bun, TS, Bash, Deno) avec **renderers React riches** — vos outils s'affichent comme les natifs, pas en JSON brut
- **Mini-apps** intégrées construites par vos Kins (SDK JS + 24 hooks React + 50+ composants themés + backend optionnel)
- **Plugins NPM** via SDK TypeScript typé (`@kinbot-developer/sdk`) + **marketplace** décentralisé
- **MCP** dynamique · **toolboxes** composables pour scoper finement les capacités par rôle

**🎨 Une IA d'agents enfin belle et fluide**
- **PWA installable**, responsive mobile-first
- **18 palettes** (aurora, ocean, forest, sunset, sakura, neon, midnight…) × light/dark × contraste adaptatif
- Design system glass/gradient, **WCAG AA**, i18n (en/fr)
- Rendu riche des résultats d'outils directement dans le fil

**🧭 Setup conversationnel, zéro YAML (Sherpa)**
- Onboarding minimal (3 écrans → chat) puis configuration entièrement guidée
- **Saisie sécurisée des secrets** : UI → coffre chiffré, jamais transmis au LLM
- Une clé OpenAI = N capacités auto-détectées · avatars auto-générés personnalisables

**📱 Vos agents, partout**
- **6 messageries natives** : Telegram, WhatsApp, Slack, Discord, Signal, Matrix
- **Transfert de canal dynamique** entre Kins en temps réel, avec contexte de handoff et chaîne de causalité

**🔒 Transparent par conception**
- **Vault AES-256-GCM** jamais exposé au LLM · comptes connectés (mail/calendrier/contacts) qui restent dans votre infra
- **Transparence des tokens** : Context Viewer détaillé, observabilité du cache Anthropic, calibration EMA par Kin — vous voyez chaque token consommé
- **Automatisation** : crons, webhooks, human-in-the-loop, scout · **multi-user** isolé

---

## 📊 Pourquoi KinBot

KinBot se compare aux **plateformes d'agents autonomes**, pas aux simples fronts de chat LLM. Voici les dimensions où il est **uniquement fort** :

| Dimension | KinBot | OpenClaw | GPTs / Assistants | LibreChat | Dify |
|---|:---:|:---:|:---:|:---:|:---:|
| Déploiement 1 conteneur, zéro infra externe | ✅ | ⚠️ daemon | n/a | ❌ Mongo | ❌ lourd |
| Session continue unique (pas de « new chat ») | ✅ | ❌ | ❌ | ❌ | ❌ |
| Collaboration inter-agents + sous-agents | ✅ | ⚠️ | ❌ | ❌ | ⚠️ workflow |
| Onboarding conversationnel (zéro YAML) | ✅ Sherpa | ⚠️ CLI | n/a | ❌ | ❌ |
| UX grand public / PWA polie | ✅ | ❌ CLI | ✅ | ✅ | ❌ builder |
| Vault secrets jamais exposé au LLM | ✅ | ❌ | n/a | ❌ | ❌ |
| Transparence tokens / contexte fine | ✅ | ❌ | ❌ | ❌ | ⚠️ debug |
| Custom tools à rendu riche + mini-apps | ✅ | ⚠️ canvas | ⚠️ | ⚠️ artifacts | ⚠️ |

Légende : ✅ fort/natif · ⚠️ partiel/dépendances · ❌ absent.

> KinBot est **production-ready pour un usage individu / petite équipe**, avec des fondations solides et un polish UX qui continue d'avancer. Nous assumons une maturité honnête (~80%) plutôt que la survente — voir la [roadmap](https://marlburrow.github.io/kinbot/) pour les arêtes connues.

---

## 🏗️ Architecture

Un process, une base SQLite, un conteneur. Tout est là — rien d'externe à brancher.

<p align="center">
  <!-- TODO: schéma d'architecture en une image — runtime Bun + SQLite, queue par Kin, mémoire hybride, SSE global, channels, vault, providers pluggables. alt="Architecture KinBot : un seul conteneur, runtime Bun, base SQLite, channels et providers" -->
  <img src="docs/assets/architecture.png" alt="Architecture KinBot : un seul conteneur, runtime Bun, base SQLite, channels et providers" width="100%" />
</p>

- **Queue par Kin** : une FIFO sérialisée par agent, priorité aux messages utilisateur — zéro race condition sur le contexte partagé.
- **SSE global** : une seule connexion temps réel par client, multiplexée par Kin.
- **Mémoire dual-channel** : extraction automatique post-compacting + outils explicites, recherche hybride vecteurs + FTS5.
- **Providers pluggables** : un config par provider, capacités (`llm`, `embedding`, `image`, `search`, `stt`, `tts`) auto-détectées.

Détails complets dans la [documentation technique](https://marlburrow.github.io/kinbot/docs/).

---

## 🤝 Contribuer

Les contributions sont bienvenues — code, plugins, mini-apps, traductions, doc, retours.

1. Lisez le **[guide de contribution](CONTRIBUTING.md)** et le **[code de conduite](CODE_OF_CONDUCT.md)**.
2. Pour développer une extension, voir **[PLUGIN-DEVELOPMENT.md](PLUGIN-DEVELOPMENT.md)** et le SDK `@kinbot-developer/sdk`.
3. Avant de pousser : `bun run typecheck` et `bun run test` (lancés aussi par le hook pre-commit).

```bash
git clone https://github.com/MarlBurroW/kinbot.git
cd kinbot
bun install
bun run dev
```

- 🐛 **Bugs / idées** → [Issues](https://github.com/MarlBurroW/kinbot/issues)
- 💬 **Questions / show & tell** → [Discussions](https://github.com/MarlBurroW/kinbot/discussions) · [Discord](#-communauté--support)
- 🔌 **Plugins** → publiez sur npm avec le mot-clé `kinbot-plugin` pour apparaître dans le marketplace

---

## 💬 Communauté & support

- **Discord** — <!-- TODO: lien d'invitation Discord -->[rejoindre la communauté](#)
- **Discussions** — [github.com/MarlBurroW/kinbot/discussions](https://github.com/MarlBurroW/kinbot/discussions)
- **Troubleshooting** — [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Sécurité** — voir [SECURITY.md](SECURITY.md) pour signaler une vulnérabilité

---

## 📄 Licence

KinBot est distribué sous licence **[MIT](LICENSE)**. Faites-en ce que vous voulez — vos données, vos clés, votre serveur, sans lock-in.

<p align="center">
  <sub>Construit avec ❤️ et <a href="https://bun.sh">Bun</a> · <a href="https://marlburrow.github.io/kinbot/">Site</a> · <a href="https://marlburrow.github.io/kinbot/docs/">Docs</a></sub>
</p>