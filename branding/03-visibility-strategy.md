# KinBot — Visibility & Launch Strategy

*Run #3 — 2026-02-25*

---

## Launch Philosophy

KinBot n'a pas de budget marketing. La visibilité se construit en trois temps :
1. **Préparer** — rendre le repo irréprochable (README, screenshots, demo)
2. **Lancer** — une vague coordonnée sur 3-4 plateformes en 48h
3. **Entretenir** — présence régulière, contributions aux listes, engagement communautaire

---

## Phase 1 : Pré-lancement (avant de poster où que ce soit)

### Checklist obligatoire

- [ ] **README héroïque** — les 3 premiers écrans doivent convaincre (voir run futur README optimization)
- [ ] **3-5 screenshots** de l'app en action (Kin avec avatar, conversation avec mémoire visible, dashboard multi-Kins)
- [ ] **GIF/vidéo de 15-30s** — montrer : créer un Kin → lui parler → il se souvient d'un fait ancien → wow
- [ ] **Open Graph image** configurée (pour les previews sociales)
- [ ] **Site GitHub Pages** clean avec hero + one-liner + lien repo
- [ ] **docker-compose.yml** qui marche en 30 secondes (testé from scratch)
- [ ] **Au moins 5-10 stars** organiques (amis, collègues) avant le push public — un repo à 0 stars n'attire personne

### Le GIF démo est critique

Ce qui doit être visible en 15 secondes :
1. Dashboard avec 2-3 Kins (avatars, noms, rôles visibles)
2. Ouvrir un Kin, poser une question qui référence un vieux contexte
3. Le Kin répond avec du contexte qu'il a retenu → "il se souvient"
4. Optionnel : montrer un Kin qui délègue à un sub-Kin

Outil recommandé : [VHS](https://github.com/charmbracelet/vhs) pour terminal, ou simple screen recording + gifski pour l'UI web.

---

## Phase 2 : Lancement coordonné

### Timing

- **Jour idéal** : Mardi ou Mercredi, 9h-11h EST (15h-17h Paris)
- **Pourquoi** : r/selfhosted et HN ont le plus de trafic en semaine, tôt dans la journée US
- **Coordonner** : poster sur les 3-4 cibles dans la même fenêtre de 2h pour que le trafic croisé se renforce

### Cible 1 : r/selfhosted (priorité maximale)

**Format :** Post texte (pas de lien direct, les mods préfèrent les discussions)

**Titre :** `I built KinBot — self-hosted AI agents with persistent memory (AGPL, one SQLite file)`

**Corps :**
```
Hey r/selfhosted,

I've been working on KinBot for the past year. The idea: AI agents that actually remember you.

Most AI tools reset every conversation. KinBot gives each agent a persistent identity (name, role, personality), continuous memory (vector + full-text search across all conversations), and the ability to collaborate with other agents.

It runs as a single process with one SQLite file. No Postgres, no Redis, no external dependencies. Docker one-liner or curl installer.

**What it does:**
- Create specialized agents ("Kins") with distinct roles and personalities
- They remember everything across sessions — no more "as an AI, I don't have memory of previous conversations"
- Agents can delegate tasks to each other
- Cron jobs, webhooks, Telegram integration
- Encrypted vault for secrets
- Multi-user with auth (admin + member roles)
- 14 AI providers supported (including Ollama for fully local)

**Stack:** Bun + Hono + React + SQLite
**License:** AGPL-3.0

GitHub: https://github.com/MarlBurroW/kinbot

Happy to answer any questions. Feedback welcome — especially on what features matter most to you for a self-hosted AI platform.
```

**Règles r/selfhosted à respecter :**
- Ne pas spammer de liens
- Répondre activement aux commentaires pendant les 6 premières heures
- Être honnête sur les limitations (pas de RAG intégré, pas de voice, etc.)

### Cible 2 : Hacker News (Show HN)

**Titre :** `Show HN: KinBot – Self-hosted AI agents with persistent identity and memory`

**URL :** Lien direct vers le repo GitHub

**Comment (premier) :**
```
Hi HN,

KinBot is a platform for creating AI agents ("Kins") that have persistent identity and continuous memory. Unlike typical chat UIs where each conversation is disposable, a Kin remembers every interaction from day one.

Key design decisions:
- Single SQLite file for everything (messages, memory vectors, config). No external DBs.
- Memory is dual-channel: automatic extraction on every LLM turn + explicit remember() tool
- Session compacting (summarization) to stay within token limits while preserving full history
- Inter-agent communication with correlation IDs and rate limiting
- AES-256-GCM vault for secrets that never appear in prompts

Built with Bun + Hono (backend) and React (frontend). Supports 14 providers including Ollama for fully local inference.

I've been running it personally for several months with agents handling everything from code review to home automation orchestration.

Source: https://github.com/MarlBurroW/kinbot
```

**Tips HN :**
- Ne pas utiliser de majuscules ou d'exclamation
- Ton technique, factuel, humble
- Mentionner les trade-offs et limitations proactivement
- Répondre à chaque commentaire, même négatif

### Cible 3 : Twitter/X

**Thread de lancement (3-4 tweets) :**

Tweet 1 :
```
🤖 I've been building KinBot — a self-hosted platform for AI agents that never forget.

Each agent has a name, personality, and memory that spans every conversation. They collaborate, run cron jobs, and live on your hardware.

One process. One SQLite file. AGPL-3.0.

↓
```

Tweet 2 :
```
Why I built this:

Every AI tool I used treated conversations as disposable. Ask something Monday, forgotten by Tuesday.

KinBot agents have continuous memory — vector search + full-text across months of interactions. They know who you are and what you've discussed.
```

Tweet 3 :
```
What makes it different from [OpenWebUI / LobeChat / etc.]:

→ Agents have identity, not just a system prompt
→ Memory persists across ALL sessions (not just the current one)
→ Agents can spawn sub-agents and talk to each other
→ Zero infra: one binary, one SQLite file, done
```

Tweet 4 :
```
github.com/MarlBurroW/kinbot

Built with Bun + Hono + React. Supports 14 providers (incl. Ollama for fully local).

Early days, feedback welcome. Star if it looks interesting ⭐
```

**Hashtags à utiliser (avec parcimonie, 1-2 par tweet) :** `#selfhosted` `#AI` `#opensource`

### Cible 4 : r/LocalLLaMA

**Angle :** Insister sur le support Ollama et la possibilité de tourner 100% local. Le sub est allergique au cloud.

**Titre :** `KinBot: self-hosted AI agents with persistent memory — works with Ollama for fully local inference`

---

## Phase 3 : Entretien (après le lancement)

### Awesome Lists (soumettre des PRs)

| Liste | URL | Critères |
|-------|-----|----------|
| awesome-selfhosted | github.com/awesome-selfhosted/awesome-selfhosted | Section "Artificial Intelligence" — projet doit être stable, documenté, FOSS |
| awesome-chatgpt | github.com/sindresorhus/awesome-chatgpt | Section alternatives/self-hosted |
| awesome-ai-agents | Plusieurs repos, chercher les plus starred | Catégorie "platforms" ou "frameworks" |

**Timing :** Attendre 1-2 semaines après le lancement pour avoir quelques stars et issues/PRs, ça crédibilise la soumission.

### Présence régulière

- **Répondre aux issues rapidement** (< 24h) — c'est le signal #1 de qualité pour un projet open-source
- **Changelog public** — chaque release avec des notes claires (les gens suivent les repos actifs)
- **Poster des updates** sur r/selfhosted quand il y a un milestone significatif (pas chaque patch)
- **Contribuer** à d'autres projets dans l'écosystème (MCP servers, Ollama, etc.) — ça ramène du trafic

### Communautés de niche

| Communauté | Action |
|------------|--------|
| **r/homelab** | Post quand il y a une feature pertinente (ex: ARM support, low resource usage) |
| **Discord self-hosted** (Selfhosted.show, TechnoTim) | Participer, mentionner naturellement quand pertinent |
| **Lemmy** (selfhosted@lemmy.world) | Crossposter le post r/selfhosted |
| **Product Hunt** | Optionnel, pas la cible principale, mais gratuit |

---

## Métriques de succès (réalistes pour un projet indie)

| Jalon | Objectif | Indicateur |
|-------|----------|------------|
| Semaine 1 | 100+ stars GitHub | Le post r/selfhosted a pris |
| Mois 1 | 500+ stars, 5+ issues/PRs de la communauté | Le projet est "vivant" |
| Mois 3 | 1000+ stars, inclusion dans awesome-selfhosted | Visibilité durable |
| Mois 6 | 2000+ stars, premiers contributeurs réguliers | Communauté naissante |

---

## Ce qu'il ne faut PAS faire

- ❌ **Spammer** — un post par plateforme, pas plus. Les gens détestent la promo répétitive.
- ❌ **Acheter des stars** ou utiliser des bots — détectable, destructeur de crédibilité.
- ❌ **Poster avant que le README soit parfait** — la première impression est définitive sur HN/Reddit.
- ❌ **Ignorer les critiques** — chaque commentaire négatif est une opportunité d'amélioration visible.
- ❌ **Survendre** — dire "early stage" si c'est early stage. L'authenticité > le hype.

---

## Priorité immédiate

**Ne pas lancer tant que ces 3 éléments ne sont pas prêts :**

1. **GIF démo** dans le README (impact visuel immédiat)
2. **Open Graph image** (previews sociales = première impression pour 80% du trafic)
3. **Docker quickstart testé** de zéro (la moitié des gens vont essayer dans les 5 min)

Tout le reste peut itérer après le lancement.

---

## Next Steps (pour les prochains runs)

- [ ] README optimization (rewrite des premiers écrans, plan screenshots)
- [ ] Rédiger le script exact du GIF démo (chaque clic, chaque phrase)
- [ ] Landing page copywriting review
- [ ] Drafts finaux des posts Reddit/HN (relecture, polish)
