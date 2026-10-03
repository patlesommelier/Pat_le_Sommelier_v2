# Pat le sommelier

Webapp qui conseille le vin de la carte d'un restaurant pour le plat choisi, en appliquant les principes d'accord de Pat. Premier restaurant : **Lola**.

- **Écrans** (repris des maquettes validées) : Accueil (choix du plat), Mes propositions, Fiche vin, Carte des vins à onglets, et la barre « Demandez à Pat » toujours visible en bas.
- **Données** : le savoir de Pat (principes, producteurs, cuvées, terroirs) et les bases de chaque restaurant (menu, profils d'accord, carte des vins, accords, règles du sommelier), selon le document « Pat le sommelier — modèle de données ».
- **Technique** : Next.js 15 (App Router) · Postgres via Netlify Database · API Claude pour Pat · déploiement Netlify.

## Mise en route

### 1. Base de données (Netlify Database)

La base Postgres est fournie par Netlify : aucune chaîne de connexion à configurer. À chaque déploiement, Netlify applique les migrations de `netlify/database/migrations/` qui ne l'ont pas encore été :

- `0001_create_schema.sql` : le schéma (repris de `supabase/migrations/0001_schema.sql`, sans les politiques RLS propres à Supabase) ;
- `0002_seed_pat_et_lola.sql` : les premières données de Pat et de Lola ;
- `0003_regles_v7_et_bases_completes.sql` : le schéma V7 (repris de `supabase/migrations/0002_…`) ;
- `0004_donnees_v7.sql` : les données à jour (règles de sélection V7, producteurs et terroirs de toutes les régions, accords de Lola), générées depuis `data/`.

Après une mise à jour des fichiers de `data/`, générer une **nouvelle** migration de données (ne jamais modifier une migration déjà appliquée). Elle refait l'import complet, ménage compris : ce qui a disparu des fichiers est retiré de la base.

```bash
npm run import -- --sql netlify/database/migrations/0005_maj_donnees.sql
```

Une évolution du schéma s'ajoute à la fois dans `supabase/migrations/` et, sans les lignes RLS, dans `netlify/database/migrations/`.

`DATABASE_URL` reste possible pour viser une autre base Postgres (Supabase par exemple) : l'app l'utilise alors à la place de Netlify Database, et `npm run import` sans `--sql` y écrit directement en appliquant `supabase/migrations/`.

### 2. Variables d'environnement

Copier `.env.example` en `.env` et remplir :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Optionnelle : autre base Postgres que Netlify Database (requise pour `npm run import` sans `--sql` et `npm run accords`) |
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

## Back-office des restaurants (`/admin`)

Espace où chaque restaurant gère son menu, sa carte, ses accords, ses règles, son apparence, ses accès et son QR code, avec un simulateur. Pat (administrateur) voit tous les restaurants et valide les producteurs proposés.

Mise en route (une fois) :

1. Supabase > Project Settings > API : copier « Project URL », la clé `anon` et la clé `service_role`.
2. Netlify > Environment variables : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (secrète), `PAT_ADMIN_EMAILS` (votre e-mail), `URL_PUBLIQUE` (adresse du site, pour le QR code). Redéployer.
3. Supabase > Authentication > Users > « Add user » : créer votre compte (e-mail de `PAT_ADMIN_EMAILS` + mot de passe).
4. Supabase > Authentication > URL Configuration : Site URL = adresse du site ; ajouter `https://<site>/admin/auth/retour` aux Redirect URLs (mot de passe oublié).
5. `npm run import` (applique la migration 0005), puis se connecter sur `https://<site>/admin`.

Les comptes des restaurants se créent ensuite dans l'écran « Accès & QR code ». Les images (logos, photos d'étiquettes) vont dans le compartiment public « medias » de Supabase Storage, créé au premier dépôt.

Une ligne modifiée dans le back-office (plat, vin, apparence) n'est plus écrasée par `npm run import` ; une note changée par le sommelier non plus.

En local sans Supabase : `AUTH_DEV_EMAIL=vous@exemple.be` dans `.env` ouvre le back-office en administrateur (ignoré sur Netlify).

## Étiquettes Wine Labs (webhook)

Wine Labs envoie un POST signé quand une demande d'étiquette est `fulfilled`, `unavailable` ou `failed`.

- Adresse à déclarer chez Wine Labs : `https://<votre-site>.netlify.app/api/webhooks/wine-labs`
- Netlify > Site configuration > Environment variables : `WINE_LABS_WEBHOOK_SECRET` = le secret `whsec_…` (jamais dans le code), puis redéployer.
- La route vérifie la signature (sinon 401), ignore un message déjà traité, enregistre la réponse dans `demande_etiquette` et met à jour l'étiquette du vin relié. Une photo ajoutée par le restaurant n'est jamais remplacée, et l'import ne remplace pas une étiquette venue de Wine Labs.

## Organisation du code

```
supabase/migrations/   schéma SQL
scripts/               import.ts (fichiers → base), generer-accords.ts (Claude → accords proposés)
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
