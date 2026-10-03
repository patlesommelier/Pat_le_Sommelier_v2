# Pat le sommelier

Webapp qui conseille le vin de la carte d'un restaurant pour le plat choisi, en appliquant les principes d'accord de Pat. Premier restaurant : **Lola**.

- **Écrans** (repris des maquettes validées) : Accueil (choix du plat), Mes propositions, Fiche vin, Carte des vins à onglets, et la barre « Demandez à Pat » toujours visible en bas.
- **Données** : le savoir de Pat (principes, producteurs, cuvées, terroirs) et les bases de chaque restaurant (menu, profils d'accord, carte des vins, accords, règles du sommelier), selon le document « Pat le sommelier — modèle de données ».
- **Technique** : Next.js 15 (App Router) · Postgres via Supabase · API Claude pour Pat · déploiement Netlify.

## Mise en route

### 1. Base de données (Supabase)

La base Postgres est hébergée sur Supabase. L'app (pages et API) et les scripts s'y connectent avec `DATABASE_URL` : *Supabase › Project Settings › Database › Connection string › « Transaction pooler »* (port 6543). Le schéma est dans `supabase/migrations/` ; `npm run import` applique les migrations qui ne l'ont pas encore été (suivi dans la table `schema_migration`), puis importe les fichiers de `data/`.

Une évolution du schéma s'ajoute dans `supabase/migrations/` (nouveau fichier, ne jamais modifier une migration déjà appliquée).

#### Venir de Netlify Database

L'app utilisait auparavant Netlify Database. Pour passer à Supabase sans rien perdre (y compris les accords déjà validés, refusés ou commentés par le sommelier) :

1. Récupérer la chaîne « Transaction pooler » du projet Supabase `ykbthpgmcqtoolrnkdsd` (*Connect* › *Transaction pooler*) ; l'utilisateur est `postgres.ykbthpgmcqtoolrnkdsd`.
2. Dans `.env`, renseigner `DATABASE_URL` (Supabase) et `NETLIFY_DB_URL` (chaîne de connexion de l'ancienne Netlify Database, à récupérer dans le tableau de bord Netlify du projet).
3. Lancer la copie, qui crée le schéma dans Supabase puis recopie chaque table (sans risque à relancer, tout ou rien) :
   ```bash
   npm run copier-vers-supabase
   ```
4. Ajouter `DATABASE_URL` dans les variables d'environnement du site Netlify, puis redéployer.
5. Une fois le site vérifié, retirer `NETLIFY_DB_URL` du `.env`. Les fichiers de `netlify/database/migrations/` sont gardés pour l'historique : Netlify exige qu'ils restent tant que la Netlify Database du site existe. Ils ne servent plus à l'app.

### 2. Variables d'environnement

Copier `.env.example` en `.env` et remplir :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Chaîne de connexion Supabase (« Transaction pooler »), requise par l'app et les scripts |
| `NETLIFY_DB_URL` | Uniquement pour `npm run copier-vers-supabase` : l'ancienne base Netlify Database |
| `ANTHROPIC_API_KEY` | Clé de l'API Claude (console.anthropic.com) |
| `ANTHROPIC_MODEL` | Modèle utilisé par Pat |
| `AFFICHER_ACCORDS_PROPOSES` | `true` pour montrer aussi les accords pas encore validés (démo) |

### 3. Importer les données

```bash
npm install
npm run import -- --dry-run   # vérifie la lecture des fichiers, n'écrit rien
npm run import                # écrit dans la base (peut être relancé sans risque)
```

### 4. Calculer les accords de Lola

```bash
npm run accords -- --restaurant lola                              # tous les plats
npm run accords -- --restaurant lola --plat lola-solettes-meuniere # un seul plat
```

Les accords sont enregistrés avec le statut **proposé**. Le sommelier les passe à **validé** (ou **refusé**) ; seuls les validés sont montrés aux clients, sauf si `AFFICHER_ACCORDS_PROPOSES=true`. Un accord validé ou refusé n'est jamais écrasé par un nouveau calcul. En attendant un écran d'administration, la validation se fait dans Supabase (Table editor › `accord` › colonne `statut`).

### 5. Lancer et déployer

```bash
npm run dev     # http://localhost:3000/lola
```

Sur **Netlify** : *Add new site › Import from Git*, choisir ce dépôt, puis ajouter les variables d'environnement ci-dessus dans *Site configuration › Environment variables*. `netlify.toml` contient déjà la configuration.

## Mettre à jour les données

Pat continue de travailler dans ses fichiers ; l'app les importe.

| Données | Fichiers | Remarque |
| --- | --- | --- |
| Principes | `data/pat/principes_pat_V5.xlsx` | Les n° ajoutés en V4/V5 sont importés comme « proposés » |
| Rôle des principes | `data/pat/roles_principes.proposition.json` | Proposition de Claude, à relire par Pat |
| Producteurs | `data/pat/producteurs/producteurs_<région>.json` ou `.xlsx` | Un fichier par région ; ancien et nouveau schéma acceptés (`commune`, `cepages`, `couleurs`, `appellations_lieux_dits`) |
| Terroirs | `data/pat/terroirs/terroirs_<région>.json` ou `.xlsx` | Un fichier par région ; le type d'origine est gardé, `niveau` le range en appellation / zone / cru / lieu-dit / autre |
| Restaurant | `data/restaurants/<id>/` | `restaurant.json` (couleurs, noms courts des plats, sections de la carte), menu, carte, accords, `regles_selection.xlsx` (règles de sélection du sommelier), `regles.json` facultatif (consignes ponctuelles : exclure un vin…), étiquettes dans `public/restaurants/<id>/etiquettes/<code>.jpg` |

Après une mise à jour : `npm run import`, puis `npm run accords` si le menu, la carte ou les principes ont changé.
Les fichiers font foi : un producteur, un terroir ou une règle retiré des fichiers est retiré de la base au prochain import.

**Règles de sélection** : `src/lib/selection.ts` applique `regles_selection.xlsx` (V7) — contenance, élimination des notes ≤ 2, score = note + ranking producteur (ranking tel que la carte le donne), départages, 4e et 5e vins, vin plus cher, vin moins cher, plafond de bulles, puis « Voir d'autres vins » pour le tour 2. Après chaque nouvelle version des règles : `npm run cas-test` vérifie l'onglet « Cas test ». Si une règle change de sens (et pas seulement de libellé), le code doit suivre.

**Normalisations faites à l'import** (décidées dans le modèle de données) : identifiants uniques `<région>-prod-<nom>` / `<région>-terr-<nom>` (l'ancien est gardé dans `ancien_id`), `statut_production` ramené à une liste fermée (la phrase d'origine va dans `statut_precision`), `mes_notes` → `avis_critique` et `notes_pat` → `avis_pat` pour les producteurs, cuvées phares converties en table `cuvee` (statut « proposé », à relire), terroirs rangés sous leur appellation quand c'est possible.

## Organisation du code

```
supabase/migrations/   schéma SQL
scripts/               import.ts (fichiers → base), generer-accords.ts (Claude → accords proposés),
                       copier-vers-supabase.ts (Netlify Database → Supabase, migration ponctuelle)
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
