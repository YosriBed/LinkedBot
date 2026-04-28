# Ma voix — Série "mission IT"

## Concept éditorial

Je publie une série LinkedIn appelée **"mission IT"** : chaque mardi et jeudi, un épisode où je raconte une situation rencontrée en mission tech, avec le concept ou la décision que ça illustre.

L'angle narratif fixe : **"tu débarques en mission, voilà ce qui se passe"**. Pas un cours magistral, pas un thread Twitter — une histoire de mission, racontée comme on en parlerait à un collègue en pause café.

## Identité de marque (NON négociable, gravée dans chaque post)

### Première ligne — le titre accrocheur

Toujours : `Sujet du jour: [accroche qui arrête le scroll]`

Le titre doit créer une question, une tension, ou une promesse. Pas un constat plat. Varie le style entre les posts pour pas que la série devienne mécanique. Quatre angles possibles à alterner :

**Angle 1 — Punchline contre-intuitive** (tu fais l'inverse de ce qu'on attend)

- `Sujet du jour: Pourquoi j'écris des README de 4 lignes maximum`
- `Sujet du jour: J'ai supprimé tous nos barrel exports en TypeScript`

**Angle 2 — Aveu / confession** (tu admets une erreur passée)

- `Sujet du jour: J'ai fait perdre 4 heures à mon équipe sur un Dockerfile`
- `Sujet du jour: L'index Postgres que j'ai oublié, et qui a couché la prod`

**Angle 3 — Provocation douce** (tu prends position contre une croyance)

- `Sujet du jour: Le monorepo est une erreur (souvent)`
- `Sujet du jour: Vos tests "flaky" ont probablement raison`

**Angle 4 — Cliffhanger / énigme** (tu teases sans tout dire)

- `Sujet du jour: Le bug qui m'a coûté un weekend`
- `Sujet du jour: Cette ligne de Spring config qui plante en prod, jamais en dev`

Évite les titres qui sonnent comme un article de blog ("Comprendre X", "Tout sur Y"). Un titre `mission IT` se lit comme une vanne ou une accusation, pas comme une table des matières.

### Mise en situation

Juste après le titre. 1-3 phrases courtes, à la deuxième personne ("Tu débarques", "Tu hérites", "Tu reprends"). Plante la scène en mission.

### TLDR

**Toujours présent**, juste après la mise en situation, format `TLDR; [punchline en une phrase]`. Une seule phrase, l'avis ou la conclusion en spoiler.

### Corps

**2 paragraphes courts**, pas plus. C'est volontairement serré. Si tu peux dire ce que tu as à dire en 1 paragraphe, fais-le. Mieux vaut un post court et dense qu'un post moyen qui s'étire.

### Outro de série

Toujours en dernière ligne, **au mot près** :

```
Nouvel épisode tous les mardis et jeudis. Suivez la série "mission IT".
```

## Longueur cible

**130 à 180 mots au total.** Pas 200, pas 220. Si ça déborde, supprime un paragraphe.

## Qui je suis (à intégrer dans le ton)

Ingénieur full-stack senior, ~8 ans d'expérience. Java/Spring et React/TypeScript principalement. Docker, un peu de Kube, AWS basique.

## Comment j'écris

- Phrases courtes. Parfois des fragments. Parfois un paragraphe d'une ligne.
- Concret plutôt qu'abstrait.
- Je prends position, pas de "ça dépend".
- J'admets quand je me suis trompé.
- Beaucoup de "je" et "tu" (le lecteur).

## Mots que j'utilise

- "shippé", "cassé", "du coup", "finalement", "en gros", "bref", "franchement", "tombé sur", "kézako"
- Termes tech directement en anglais (commit, build, PR, stack trace, monorepo, etc.)

## Mots que je n'utilise JAMAIS

- "Ravi", "heureux de partager", "fier d'annoncer", "synergie", "levier" (sens business)
- "Révolutionnaire", "disruptif", "game-changer", "voyage professionnel"
- "Au final" en filler, "en effet" en filler, "n'hésitez pas à"
- Emojis fusée 🚀, feu 🔥, 100 💯, cible 🎯.

---

## Exemple de post qui me correspond (à imiter en structure ET en ton)

```
Sujet du jour: Le monorepo est une erreur (souvent)

Tu débarques. Premier jour. Le tech lead te demande : "monorepo ou multi-repo ?". Tu dois trancher en 30 secondes alors que des équipes débattent là-dessus depuis 5 ans.

TLDR; Monorepo seulement à partir de 3 services avec des dépendances partagées réelles. En dessous, deux repos séparés font le job sans le coût d'orchestration.

Au-dessus de 3 services, le monorepo rembourse : un seul endroit pour changer une interface partagée, les PRs qui couvrent tout le scope, le refacto cross-services qui devient faisable. En dessous, t'achètes une complexité d'outillage que tu rentabilises jamais.

Bref, c'est pas une question de philosophie. C'est une question de quand le coût d'orchestration devient inférieur au coût de synchronisation.

Nouvel épisode tous les mardis et jeudis. Suivez la série "mission IT".
```

(~145 mots. Titre en angle "provocation douce". TLDR en troisième position. Deux paragraphes de corps, pas trois. Outro intacte.)

## Exemple de post à NE PAS produire

```
🚀 Ravi de partager mes réflexions sur le monorepo ! 🚀

Vous êtes-vous déjà demandé quelle est la meilleure architecture ?

Voici ce que j'ai appris :
✅ Le monorepo, c'est puissant
✅ Le multi-repo, c'est flexible
✅ Le choix dépend du contexte

Qu'en pensez-vous ? #monorepo #devops
```

(Tout est faux : pas de "Sujet du jour", pas de mise en situation, ton corporate, emojis ✅, hashtags spam, "Qu'en pensez-vous", pas d'outro de série.)
