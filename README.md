# Pat le sommelier

Webapp qui conseille le vin de la carte d'un restaurant pour le plat choisi, en appliquant les principes d'accord de Pat. Premier restaurant : **Lola**.

- **Écrans** (repris des maquettes validées) : Accueil (choix du plat), Mes propositions, Fiche vin, Carte des vins à onglets, et la barre « Demandez à Pat » toujours visible en bas.
- **Données** : le savoir de Pat (principes, producteurs, cuvées, terroirs) et les bases de chaque restaurant (menu, profils d'accord, carte des vins, accords, règles du sommelier), selon le document « Pat le sommelier — modèle de données ».
- **Technique** : Next.js 15 (App Router) · Postgres hébergé chez Supabase · API Claude pour Pat · déploiement Netlify.

## Mise en route

### 1. Base de données (Supabase)

1. Créer un projet sur [supabase.com](https://supabase.com) (région Europe).
2. Dans **SQL Editor**, coller et exécuter `supabase/migrations/0001_schema.sql`. Les migrations suivantes (`0002_…`) sont appliquées automatiquement : par Netlify avant chaque déploiement de production (`npm run migrer`, voir `netlify.toml`), et par `npm run import`. Une nouvelle migration s'ajoute simplement dans `supabase/migrations/` ; elle ne doit jamais être modifiée une fois appliquée.
3. Récupérer la chaîne de connexion : **Project Settings › Database › Connection string › Transaction pooler** (port 6543).

### 2. Variables d'environnement

Copier `.env.example` en `.env` et remplir :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | Connexion Postgres (app et scripts). Dans Netlify, portée « Builds » et « Functions » : le build applique les migrations |
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

### 4 bis. Commentaires d'accord (client)

Les commentaires que voit le client sont réécrits plat par plat, tous les vins d'un plat en une passe, sans toucher aux notes :

```bash
npm run commentaires -- --restaurant lola                                  # aperçu : data/commentaires-lola.json, rien en base
npm run commentaires -- --restaurant lola --plat lola-solettes-meuniere    # un seul plat
npm run commentaires -- --restaurant lola --ecrire                         # écrit les commentaires valides en base
```

Chaque commentaire : une phrase de 12 à 22 mots, positive, avec un élément propre au vin ; un vin noté 2/5 ou moins nomme le plat où il s'exprimera mieux. Le champ interne `limite` (ce qui empêche une note plus haute) n'est affiché qu'aux administrateurs. Après génération, les mots interdits, la longueur et les quasi-doublons d'un même plat sont contrôlés ; les fautifs sont régénérés deux fois au plus, puis signalés sans être écrits. L'import des fichiers garde ces commentaires tant que la note ne change pas.

### 4 ter. Régénérer les accords (bouton du back-office)

Dans **Accords**, « Régénérer ce plat » ou « Régénérer tous les accords » : Pat recalcule la note et le commentaire de chaque vin disponible sur chaque plat (un appel à Claude par plat, trois plats à la fois), puis les contrôle comme ci-dessus. Les accords sont écrits **validés** et sont en ligne tout de suite ; une note changée à la main dans le back-office est gardée, un accord refusé reste refusé, un vin dont la réponse reste fautive garde son accord actuel. L'import des fichiers ne remplace plus un accord régénéré.

Le travail tourne dans une fonction Netlify d'arrière-plan (`netlify/functions/generer-accords-background.mts`, file `generation_accords`) ; la page affiche la progression. Il faut `ANTHROPIC_API_KEY` dans les variables Netlify (portée Functions). Même chose depuis un ordinateur :

```bash
npm run regenerer -- --restaurant lola                              # tous les plats
npm run regenerer -- --restaurant lola --plat lola-solettes-meuniere # un seul plat
```

### 4 quater. Carte des vins imprimable

Back-office › Carte des vins › **Imprimer la carte** (`/admin/<resto>/carte/imprimer`) : une couverture (logo ou nom, QR code), puis les vins par couleur et par région, chacun présenté par Pat en trois à quatre lignes. La barre en haut (visible à l'écran seulement) règle le format (A4/A5), le noir et blanc, l'ordre (région ou prix), l'affichage des présentations, des producteurs, de la couverture et du rappel « Demandez à Pat », et ouvre le menu d'impression du navigateur (« Enregistrer en PDF » pour un fichier). Mise en page : `src/lib/carte-imprimable.ts`.

- **Bouton « Imprimer la carte »** : s'il manque des présentations (vins disponibles sans texte de Pat ni texte corrigé), Pat les écrit d'abord en arrière-plan (fonction Netlify `generer-presentations-background`, une tâche par couleur, file `generation_presentations`) ; une page d'attente suit l'avancement puis ouvre la carte toute seule (« Imprimer sans attendre » pour ne pas attendre). Les textes existants ne sont jamais réécrits. S'il ne manque rien, la carte s'ouvre directement.
- **Présentations** (en ligne de commande, pour tout régénérer) : `npm run presentations -- --restaurant lola` (ou `--apercu` pour seulement les afficher). Trois phrases par vin (le lieu ou le vigneron, le style expliqué par sa cause, ce avec quoi il brille à table), 230 à 380 caractères, tirées uniquement du descriptif, de la présentation du domaine, de l'avis de Pat et des cépages ; contrôle des mots interdits, de la longueur et des doublons, puis régénération. Le restaurant peut corriger le texte dans la fiche du vin : sa version est prioritaire et n'est jamais régénérée. Sans présentation, la carte prend le résumé court.
- **Cuisine interne** : seuls les champs publics des vins sont lus, jamais de ranking, de note ni de score.
- **Mise en page** : un vin n'est jamais coupé entre deux pages et un titre de région reste avec son premier vin ; compter une dizaine de pages A4 pour 70 vins. Un vin indisponible n'apparaît pas ; un producteur déjà dans le nom du vin n'est pas répété.
- **Navigateurs** : les en-têtes et numéros de page utilisent les marges de page CSS (Chrome 131 et plus). Dans Safari ou Firefox, l'impression fonctionne, sans en-tête ni numéro. Pour garder la couverture en couleur, cocher « Graphiques d'arrière-plan » dans la fenêtre d'impression.

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
