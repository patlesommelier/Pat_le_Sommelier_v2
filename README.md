# Pat le sommelier

Webapp qui conseille le vin de la carte d'un restaurant pour le plat choisi, en appliquant les principes d'accord de Pat. Premier restaurant : **Lola**.

- **Écrans** (repris des maquettes validées) : Accueil (choix du plat), Mes propositions, Fiche vin, Carte des vins à onglets, et la barre « Demandez à Pat » toujours visible en bas.
- **Données** : le savoir de Pat (principes, producteurs, cuvées, terroirs) et les bases de chaque restaurant (menu, profils d'accord, carte des vins, accords, règles du sommelier), selon le document « Pat le sommelier — modèle de données ».
- **Technique** : Next.js 15 (App Router) · Postgres Netlify Database · API Claude pour Pat · déploiement Netlify.

## Mise en route

### 1. Base de données (Netlify Database)

La base est une Netlify Database (Postgres géré par Netlify) : aucun compte ni chaîne de connexion à configurer. Netlify fournit la connexion à l'app (`NETLIFY_DB_URL`) et applique automatiquement, à chaque déploiement et avant la mise en ligne, les migrations de `netlify/database/migrations` :

- `0001_create-schema.sql` : le schéma (tables du savoir de Pat et des restaurants) ;
- `<date>_import-donnees.sql` : les données, générées par `npm run import` à partir des fichiers de `data/`.

Chaque aperçu de déploiement (*Deploy Preview*) a sa propre copie de la base : les essais n'affectent pas la production.

### 2. Variables d'environnement

Dans *Site configuration › Environment variables* (et dans `.env` en local, copié depuis `.env.example`) :

| Variable | Rôle |
| --- | --- |
| `ANTHROPIC_API_KEY` | Clé de l'API Claude (console.anthropic.com) |
| `ANTHROPIC_MODEL` | Modèle utilisé par Pat |
| `AFFICHER_ACCORDS_PROPOSES` | `true` pour montrer aussi les accords pas encore validés (démo) |

### 3. Importer les données

```bash
npm install
npm run import -- --dry-run   # vérifie la lecture des fichiers, n'écrit rien
npm run import                # écrit netlify/database/migrations/<date>_import-donnees.sql
```

Pousser ensuite la nouvelle migration sur Git : le déploiement suivant l'applique. Elle peut être rejouée sans risque (mises à jour et ménage, comme avant) ; une migration déjà appliquée ne doit jamais être modifiée, on en génère une nouvelle. Chaque import pèse environ 10 Mo : on peut supprimer les anciennes migrations d'import **qui n'ont pas encore été déployées**, jamais celles déjà appliquées.

### 4. Calculer les accords de Lola (facultatif)

Les accords de Lola viennent du fichier `accords.xlsx` de Pat (importés comme **validés**). Le script de calcul par Claude écrit directement dans une base Postgres : il sert en local, avec `netlify dev` (qui fournit `NETLIFY_DB_URL`) ou une base indiquée par `DATABASE_URL`.

```bash
npm run accords -- --restaurant lola                              # tous les plats
npm run accords -- --restaurant lola --plat lola-solettes-meuniere # un seul plat
```

Les accords calculés sont enregistrés avec le statut **proposé**. Le sommelier les passe à **validé** (ou **refusé**) ; seuls les validés sont montrés aux clients, sauf si `AFFICHER_ACCORDS_PROPOSES=true`. Un accord validé ou refusé n'est jamais écrasé par un nouveau calcul.

### 5. Lancer et déployer

```bash
netlify dev     # http://localhost:8888/lola (fournit la base Netlify en local)
```

Sur **Netlify** : chaque push déploie le site et applique les migrations en attente. `netlify.toml` contient déjà la configuration.

## Mettre à jour les données

Pat continue de travailler dans ses fichiers ; l'app les importe.

| Données | Fichiers | Remarque |
| --- | --- | --- |
| Principes | `data/pat/principes_pat_V5.xlsx` | Les n° ajoutés en V4/V5 sont importés comme « proposés » |
| Rôle des principes | `data/pat/roles_principes.proposition.json` | Proposition de Claude, à relire par Pat |
| Producteurs | `data/pat/producteurs/producteurs_<région>.json` ou `.xlsx` | Un fichier par région ; ancien et nouveau schéma acceptés (`commune`, `cepages`, `couleurs`, `appellations_lieux_dits`) |
| Terroirs | `data/pat/terroirs/terroirs_<région>.json` ou `.xlsx` | Un fichier par région ; le type d'origine est gardé, `niveau` le range en appellation / zone / cru / lieu-dit / autre |
| Restaurant | `data/restaurants/<id>/` | `restaurant.json` (couleurs, noms courts des plats, sections de la carte), menu, carte, accords, `regles_selection.xlsx` (règles de sélection du sommelier), `regles.json` facultatif (consignes ponctuelles : exclure un vin…), étiquettes dans `public/restaurants/<id>/etiquettes/<code>.jpg` |

Après une mise à jour : `npm run import`, puis pousser la migration générée sur Git.
Les fichiers font foi : un producteur, un terroir ou une règle retiré des fichiers est retiré de la base au prochain import.

**Règles de sélection** : `src/lib/selection.ts` applique `regles_selection.xlsx` (V7) — contenance, élimination des notes ≤ 2, score = note + ranking producteur (ranking tel que la carte le donne), départages, 4e et 5e vins, vin plus cher, vin moins cher, plafond de bulles, puis « Voir d'autres vins » pour le tour 2. Après chaque nouvelle version des règles : `npm run cas-test` vérifie l'onglet « Cas test ». Si une règle change de sens (et pas seulement de libellé), le code doit suivre.

**Normalisations faites à l'import** (décidées dans le modèle de données) : identifiants uniques `<région>-prod-<nom>` / `<région>-terr-<nom>` (l'ancien est gardé dans `ancien_id`), `statut_production` ramené à une liste fermée (la phrase d'origine va dans `statut_precision`), `mes_notes` → `avis_critique` et `notes_pat` → `avis_pat` pour les producteurs, cuvées phares converties en table `cuvee` (statut « proposé », à relire), terroirs rangés sous leur appellation quand c'est possible.

## Organisation du code

```
netlify/database/      migrations : schéma SQL et données importées
scripts/               import.ts (fichiers → migration de données), generer-accords.ts (Claude → accords proposés)
src/lib/pat-cerveau.ts ce que Pat sait et comment on le lui présente (partagé app + scripts)
src/app/[resto]/       écrans : accueil, plat/[plat], vin/[vin], carte
src/app/api/pat/       barre « Demandez à Pat » (Claude, uniquement des vins de la carte)
data/                  fichiers sources de Pat et des restaurants
```

## Prochaines étapes

- Écran sommelier : valider ou refuser les accords proposés, gérer les règles et la disponibilité des vins.
- Fiches producteurs Loire, Bordeaux, Champagne… : 39 vins de Lola ne sont pas encore reliés à un producteur de Pat.
- Ajouter Bistro Bercuit et Happy's Kitchen Club (un dossier `data/restaurants/<id>/` chacun).
- Dictée vocale dans la barre « Demandez à Pat ».
