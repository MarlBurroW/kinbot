# KinBot 1.0 — Éviter le look « AI-generated »

> Guide de recherche + **audit honnête de notre aperçu Foyer dark**. Objectif : garder notre identité aurora mais ne pas ressembler au site pondu par défaut par un LLM. À appliquer pendant le dev du site.

## TL;DR

Les LLM, sans contraintes, produisent **« la moyenne mathématique d'Internet »** : police safe (Inter), **gradient violet/indigo**, hero centré + 2 boutons, **3 features en cartes à coins arrondis avec une icône**, glow blobs, bento, glassmorphism, ombres à 0.1 d'opacité. Le piège : notre palette **aurora (violet→rose→pêche)** est précisément le cliché n°1 de l'IA. La différence entre « cliché » et « marque assumée » tient à **3 choses** : (1) du **vrai produit** (screenshots réels, pas des blobs), (2) une **exécution intentionnelle** (asymétrie, hiérarchie, craft), (3) une **personnalité** (voix, illustrations propriétaires). On a déjà des atouts (avatars maison, screenshots en fondu, voix FR précise, chaleur pêche) — il faut les pousser et désamorcer les tics.

---

## Pourquoi tous les sites IA se ressemblent

- **Le centre statistique.** À la génération, le modèle échantillonne le choix le plus probable quand aucune contrainte n'est donnée. Or les choix « safe et universels » dominent les données d'entraînement → tout converge vers le même rendu. *(prg.sh, dev.to)*
- **L'héritage `indigo-500`.** Quand Tailwind a lancé sa lib de composants, la couleur de démo par défaut était `bg-indigo-500`. Cinq ans de tutos et de templates plus tard, le violet/indigo est devenu le réflexe par défaut des LLM. *(prg.sh)*
- **Conséquence** : un site « techniquement propre mais émotionnellement invisible », qui échoue aux tests *Know / Like / Trust* — il ne paraît ni unique, ni incarné, ni digne de confiance. *(axe-web)*

---

## Les « tells » du design AI-generated

| # | Tell | Présent dans notre aperçu Foyer dark ? |
|---|---|---|
| 1 | **Gradient violet/indigo** (surtout sur fond blanc) | ⚠️ **Oui** — c'est notre gradient aurora signature |
| 2 | Police **Inter / Roboto / system** sans personnalité | 🟡 Partiel — Plus Jakarta (mieux qu'Inter, mais reste un sans géométrique « centre ») |
| 3 | **Hero centré** : titre + sous-titre + 2 boutons | ✅ Évité — notre hero est en split asymétrique |
| 4 | **3 features en cartes arrondies + icône** | ⚠️ **Oui** — on a plusieurs triplets « icône-dans-carré-arrondi » |
| 5 | **Glow blobs / orbs** atmosphériques flous | ⚠️ **Oui** — glows g1/g2/g3 dans le hero et le footer |
| 6 | **Bento grid** partout | 🟡 Oui (section self-host) — devenu le défaut 2026, pas rédhibitoire mais ubiquitaire |
| 7 | **Glassmorphism** sur tout | 🟡 Léger (cartes Kin) — toléré s'il reste restreint |
| 8 | **Coins arrondis sur tout**, ombres à 0.1 d'opacité | ⚠️ **Oui** — radius uniforme, ombres douces génériques |
| 9 | Icône **✨ sparkles** comme accent | ⚠️ **Oui** — eyebrow du hero (même en lucide, le sparkle = tell IA) |
| 10 | **Stock photos** d'équipe / d'avatars | ✅ Évité — nos avatars sont des illustrations maison générées |
| 11 | **Copy générique** + tirets cadratins « — » à outrance, « Unlock / Supercharge / Meet X » | ⚠️ À surveiller — notre copy abuse du « — » |
| 12 | **Tout symétrique**, aucun white-space intentionnel, hiérarchie = juste la taille | 🟡 Partiel |

Légende : ⚠️ tic à désamorcer · 🟡 zone grise à exécuter avec soin · ✅ déjà évité.

---

## Audit Foyer dark — risques & mitigations

**1. Le gradient aurora (le gros sujet).** C'est LE cliché n°1, mais c'est aussi l'identité réelle de l'app KinBot — donc *justifié*, pas paresseux. Mitigations :
- Ne **jamais** le poser en grand aplat sur fond blanc (on est dark → déjà ok).
- **Forcer la pêche/chaud** pour casser le « violet pur SaaS » : c'est notre signe distinctif, à doser plus haut.
- L'utiliser **avec parcimonie et intention** (texte d'accent, fines bordures, le Kin actif) — pas en blobs décoratifs gratuits.

**2. Glow blobs (g1/g2/g3).** Très « AI atmospheric ». Mitigation : réduire le nombre, les **motiver** (derrière un élément réel), et surtout **remplacer le vide par du vrai produit** — un vrai screenshot en fondu vaut dix orbs flous.

**3. Triplets « icône-dans-carré-arrondi ».** Le tell SaaS par excellence. Mitigations : en remplacer une partie par de **vrais screenshots** ou des démos animées ; varier la mise en page (pas 3× le même bloc) ; réduire le nombre de listes à icônes.

**4. Sparkles ✨.** À **retirer** de l'eyebrow → icône plus spécifique et signifiante (ex. `bot`, `users`, `infinity`, ou pas d'icône du tout).

**5. Radius / ombres uniformes.** Varier les rayons intentionnellement, assumer quelques éléments plus francs/nets, éviter l'ombre « 0.1 opacity » par défaut.

**6. Typo.** Plus Jakarta est correct (≠ Inter) mais reste « centre de distribution ». Pour gagner en caractère **sans serif** : envisager un display un peu plus typé pour les très gros titres (ex. **Space Grotesk** — déjà testé en variante A), ou compenser par un **craft typographique** fort (échelle, tracking serré, contrastes de graisse 800/400).

**7. Copy.** Bannir les tics : tirets cadratins en rafale, « — en un seul conteneur — », formules « Unlock/Supercharge/Elevate », « Meet your AI team ». Voix FR concrète, phrases de longueurs variées, bénéfices spécifiques chiffrés.

---

## Nos armes anti-slop (à pousser)

Ce qui nous éloigne *déjà* du template IA — à renforcer, c'est là qu'est la différenciation :

- **Du vrai produit, en fondu.** Notre système de screenshots feather (vraies captures de l'app fusionnées au fond) est l'antidote n°1 au « site moyen ». Plus on montre l'app réelle, moins ça sent l'IA.
- **Avatars propriétaires.** Nos robots générés (pas de stock photo) + noms d'experts mappés en JSON = personnalité de marque unique.
- **Chaleur pêche + dark tiède.** Casse le « violet sur blanc clinique ».
- **Voix spécifique et honnête.** Copy FR concrète, page `/roadmap` qui assume la maturité ~80 % — l'honnêteté est l'inverse du slop.
- **Sims fidèles au code réel** (recall, tokens) — des détails justes que l'IA générique n'inventerait pas.
- **Animation signifiante** (Sherpa seul → pop des autres Kins) qui *raconte l'onboarding* au lieu d'un micro-hover gratuit.

---

## Checklist dev — do / don't

**À faire**
- [ ] Privilégier les **vrais screenshots (en fondu)** aux illustrations abstraites et aux blobs.
- [ ] **Doser la pêche/chaud** pour singulariser le gradient aurora.
- [ ] **Varier les layouts** de section (pas 3× le triplet à icônes) ; alterner texte/produit/données.
- [ ] **Asymétrie & white-space** intentionnels ; hiérarchie par plus que la taille.
- [ ] **Craft typo** : échelle nette, graisses contrastées ; envisager un display typé pour les H1.
- [ ] Animations **qui racontent** quelque chose (onboarding, collaboration).
- [ ] Copy **humaine et variée**, bénéfices spécifiques.

**À éviter**
- [ ] ✨ Sparkles en accent ; gradient violet en grand aplat ; orbs flous décoratifs gratuits.
- [ ] Triplets « icône-carré-arrondi » à répétition.
- [ ] Coins arrondis + ombres 0.1 **uniformes** partout.
- [ ] Inter par défaut ; copy « Unlock/Supercharge/Meet X » ; tirets cadratins en rafale.
- [ ] Stock photos ; bento « générique » (icône+texte) sans vrai contenu.

---

## Sources
- [Why Your AI Keeps Building the Same Purple Gradient Website — prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website)
- [Why Every AI-Generated Landing Page Looks the Same (and How to Fix It) — dev.to](https://dev.to/_46ea277e677b888e0cd13/why-every-ai-generated-landing-page-looks-the-same-and-how-to-fix-it-1kmo)
- [Why AI Websites All Look the Same (And When It Matters) — AXE-WEB](https://axe-web.com/insights/ai-website-design-sameness/)
- [Web Design Trends 2026: Reality Check — Studio Meyer](https://studiomeyer.io/en/blog/webdesign-trends-2026-reality-check)
